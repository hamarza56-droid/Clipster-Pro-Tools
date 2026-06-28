import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import pool from "../db/index.js";
import { uploadFile, downloadFile, getSignedFileUrl } from "../services/storage.js";
import { applyBackgroundSwap, ensureDir } from "../services/videoProcessor.js";
import { detectLogoInVideo } from "../services/logoDetector.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/tmp/" });
const uploadMultiple = multer({ dest: "uploads/tmp/" });

const TMP_DIR = path.resolve("uploads/tmp");
const EXPORTS_DIR = path.resolve("exports");
ensureDir(TMP_DIR);
ensureDir(EXPORTS_DIR);

router.use(requireAuth);

// In-memory job tracker for bulk processing runs, keyed per user+campaign so
// one person's bulk job progress never leaks to a teammate polling the same
// campaign. Not persisted across server restarts — that's fine, it's live progress only.
const bulkJobs = new Map(); // `${userId}:${campaignId}` -> { total, completed, failed, running, results: [] }

function bulkJobKey(userId, campaignId) {
  return `${userId}:${campaignId}`;
}

// Upload multiple clips at once for a campaign (owned by the requesting user)
router.post("/bulk", uploadMultiple.array("videos", 50), async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: "campaignId and at least one video file are required" });
    }

    const campaignResult = await pool.query("SELECT * FROM campaigns WHERE id = $1", [campaignId]);
    if (!campaignResult.rows[0]) return res.status(404).json({ error: "Campaign not found" });

    const createdClips = [];

    for (const file of req.files) {
      try {
        const id = nanoid(10);
        const ext = path.extname(file.originalname) || ".mp4";
        const sourceKey = `clips/${id}/source${ext}`;

        await uploadFile(file.path, sourceKey, file.mimetype);

        await pool.query(
          `INSERT INTO clips (id, campaign_id, user_id, original_filename, source_key, status)
           VALUES ($1, $2, $3, $4, $5, 'uploaded')`,
          [id, campaignId, req.user.id, file.originalname, sourceKey]
        );

        const localCopy = path.join(TMP_DIR, `${id}${ext}`);
        fs.copyFileSync(file.path, localCopy);
        fs.unlinkSync(file.path);

        const clipResult = await pool.query("SELECT * FROM clips WHERE id = $1", [id]);
        createdClips.push(clipResult.rows[0]);
      } catch (innerErr) {
        console.error(`Failed to upload ${file.originalname}:`, innerErr);
        // Continue with the rest of the batch even if one file fails
      }
    }

    res.status(201).json({ clips: createdClips, uploadedCount: createdClips.length, requestedCount: req.files.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Kick off background-swap processing for all of the requesting user's own
// "uploaded" (unprocessed) clips in a campaign, one at a time. Returns
// immediately; poll /bulk-status/:campaignId for progress.
router.post("/bulk-process/:campaignId", upload.single("backgroundFile"), async (req, res) => {
  const { campaignId } = req.params;
  const { backgroundType = "color", backgroundValue = "#0a0a0a", scalePercent = 80 } = req.body;
  const jobKey = bulkJobKey(req.user.id, campaignId);

  try {
    const campaignResult = await pool.query("SELECT * FROM campaigns WHERE id = $1", [campaignId]);
    if (!campaignResult.rows[0]) return res.status(404).json({ error: "Campaign not found" });

    const existing = bulkJobs.get(jobKey);
    if (existing && existing.running) {
      return res.status(409).json({ error: "A bulk processing job is already running for this campaign" });
    }

    const pendingResult = await pool.query(
      "SELECT * FROM clips WHERE campaign_id = $1 AND user_id = $2 AND status = 'uploaded'",
      [campaignId, req.user.id]
    );
    const pendingClips = pendingResult.rows;

    if (pendingClips.length === 0) {
      return res.status(400).json({ error: "No unprocessed clips found for this campaign" });
    }

    // If a custom background image was uploaded, save it once to a stable path —
    // every clip in this batch reuses the same file rather than re-uploading it.
    let resolvedBackgroundValue = backgroundValue;
    if (backgroundType === "image" && req.file) {
      const bgPath = path.join(TMP_DIR, `bulk-bg-${jobKey}${path.extname(req.file.originalname) || ".jpg"}`);
      fs.copyFileSync(req.file.path, bgPath);
      fs.unlinkSync(req.file.path);
      resolvedBackgroundValue = bgPath;
    } else if (backgroundType === "image" && !req.file) {
      return res.status(400).json({ error: "backgroundFile is required when backgroundType is 'image'" });
    }

    const job = { total: pendingClips.length, completed: 0, failed: 0, running: true, results: [] };
    bulkJobs.set(jobKey, job);

    // Respond immediately — processing continues server-side.
    res.status(202).json({ message: "Bulk processing started", total: job.total });

    // Process sequentially (not in parallel) — running multiple ffmpeg jobs at
    // once on a memory-constrained host is what causes OOM crashes.
    (async () => {
      for (const clip of pendingClips) {
        try {
          const videoLocalPath = path.join(TMP_DIR, `${clip.id}${path.extname(clip.source_key)}`);
          if (!fs.existsSync(videoLocalPath)) {
            await downloadFile(clip.source_key, videoLocalPath);
          }

          const outputPath = path.join(EXPORTS_DIR, `${clip.id}-export.mp4`);

          await applyBackgroundSwap({
            inputPath: videoLocalPath,
            outputPath,
            backgroundType,
            backgroundValue: resolvedBackgroundValue,
            scalePercent: Number(scalePercent),
          });

          const exportKey = `clips/${clip.id}/export.mp4`;
          await uploadFile(outputPath, exportKey, "video/mp4");

          await pool.query(
            `UPDATE clips SET export_key = $1, status = 'processed', background_type = $2, background_value = $3, updated_at = now() WHERE id = $4`,
            [exportKey, backgroundType, backgroundType === "color" ? backgroundValue : null, clip.id]
          );

          job.completed++;
          job.results.push({ clipId: clip.id, filename: clip.original_filename, success: true });
        } catch (err) {
          console.error(`Bulk processing failed for clip ${clip.id}:`, err);
          job.failed++;
          job.results.push({ clipId: clip.id, filename: clip.original_filename, success: false, error: err.message });
        }
      }
      job.running = false;
      if (backgroundType === "image" && fs.existsSync(resolvedBackgroundValue)) {
        try {
          fs.unlinkSync(resolvedBackgroundValue);
        } catch {
          // non-fatal cleanup failure
        }
      }
    })();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// Poll progress of the requesting user's bulk processing job for a campaign
router.get("/bulk-status/:campaignId", (req, res) => {
  const job = bulkJobs.get(bulkJobKey(req.user.id, req.params.campaignId));
  if (!job) return res.json({ running: false, total: 0, completed: 0, failed: 0, results: [] });
  res.json(job);
});

// Upload a new clip for a campaign, owned by the requesting user
router.post("/", upload.single("video"), async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId || !req.file) {
      return res.status(400).json({ error: "campaignId and video file are required" });
    }

    const campaignResult = await pool.query("SELECT * FROM campaigns WHERE id = $1", [campaignId]);
    if (!campaignResult.rows[0]) return res.status(404).json({ error: "Campaign not found" });

    const id = nanoid(10);
    const ext = path.extname(req.file.originalname) || ".mp4";
    const sourceKey = `clips/${id}/source${ext}`;

    await uploadFile(req.file.path, sourceKey, req.file.mimetype);

    await pool.query(
      `INSERT INTO clips (id, campaign_id, user_id, original_filename, source_key, status)
       VALUES ($1, $2, $3, $4, $5, 'uploaded')`,
      [id, campaignId, req.user.id, req.file.originalname, sourceKey]
    );

    // Keep the local tmp copy briefly for the detect step the user will likely trigger next
    const localCopy = path.join(TMP_DIR, `${id}${ext}`);
    fs.copyFileSync(req.file.path, localCopy);
    fs.unlinkSync(req.file.path);

    const clipResult = await pool.query("SELECT * FROM clips WHERE id = $1", [id]);
    res.status(201).json({ clip: clipResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fetch a clip the requesting user owns, or null. Centralizes the ownership
 * check so every route below enforces it the same way.
 */
async function getOwnedClip(clipId, userId) {
  const result = await pool.query("SELECT * FROM clips WHERE id = $1 AND user_id = $2", [clipId, userId]);
  return result.rows[0] || null;
}

// Run logo detection against the campaign's reference logo
router.post("/:id/detect-logo", async (req, res) => {
  try {
    const clip = await getOwnedClip(req.params.id, req.user.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    const campaignResult = await pool.query("SELECT * FROM campaigns WHERE id = $1", [clip.campaign_id]);
    const campaign = campaignResult.rows[0];
    if (!campaign?.logo_reference_key) {
      return res.status(400).json({
        error: "This campaign has no logo reference image uploaded. Add one on the campaign first.",
      });
    }

    const videoLocalPath = path.join(TMP_DIR, `${clip.id}${path.extname(clip.source_key)}`);
    if (!fs.existsSync(videoLocalPath)) {
      await downloadFile(clip.source_key, videoLocalPath);
    }

    const logoLocalPath = path.join(TMP_DIR, `logo-${campaign.id}${path.extname(campaign.logo_reference_key)}`);
    if (!fs.existsSync(logoLocalPath)) {
      await downloadFile(campaign.logo_reference_key, logoLocalPath);
    }

    const framesDir = path.join(TMP_DIR, `frames-${clip.id}`);
    const result = await detectLogoInVideo({
      videoPath: videoLocalPath,
      logoReferencePath: logoLocalPath,
      framesDir,
    });

    await pool.query(
      `UPDATE clips SET logo_detected = $1, logo_confidence = $2, status = 'logo-checked', updated_at = now() WHERE id = $3`,
      [result.detected, result.confidence, clip.id]
    );

    const updatedResult = await pool.query("SELECT * FROM clips WHERE id = $1", [clip.id]);
    res.json({ clip: updatedResult.rows[0], detection: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Apply background swap and produce the export
router.post("/:id/process", upload.single("backgroundFile"), async (req, res) => {
  try {
    const clip = await getOwnedClip(req.params.id, req.user.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    const { backgroundType = "color", backgroundValue = "#0a0a0a", scalePercent = 80 } = req.body;

    const videoLocalPath = path.join(TMP_DIR, `${clip.id}${path.extname(clip.source_key)}`);
    if (!fs.existsSync(videoLocalPath)) {
      await downloadFile(clip.source_key, videoLocalPath);
    }

    let resolvedBackgroundValue = backgroundValue;
    if ((backgroundType === "image" || backgroundType === "video") && req.file) {
      const bgLocalPath = path.join(TMP_DIR, `bg-${clip.id}${path.extname(req.file.originalname)}`);
      fs.copyFileSync(req.file.path, bgLocalPath);
      fs.unlinkSync(req.file.path);
      resolvedBackgroundValue = bgLocalPath;
    }

    const outputPath = path.join(EXPORTS_DIR, `${clip.id}-export.mp4`);

    await applyBackgroundSwap({
      inputPath: videoLocalPath,
      outputPath,
      backgroundType,
      backgroundValue: resolvedBackgroundValue,
      scalePercent: Number(scalePercent),
    });

    const exportKey = `clips/${clip.id}/export.mp4`;
    await uploadFile(outputPath, exportKey, "video/mp4");

    await pool.query(
      `UPDATE clips SET export_key = $1, status = 'processed', background_type = $2, background_value = $3, updated_at = now() WHERE id = $4`,
      [exportKey, backgroundType, backgroundType === "color" ? backgroundValue : null, clip.id]
    );

    const updatedResult = await pool.query("SELECT * FROM clips WHERE id = $1", [clip.id]);
    const previewUrl = await getSignedFileUrl(exportKey, 3600);

    res.json({ clip: updatedResult.rows[0], previewUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get a signed preview URL for a clip's source or export
router.get("/:id/preview", async (req, res) => {
  try {
    const clip = await getOwnedClip(req.params.id, req.user.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    const key = req.query.version === "source" ? clip.source_key : clip.export_key || clip.source_key;
    if (!key) return res.status(404).json({ error: "No file available for this clip" });

    const url = await getSignedFileUrl(key, 3600);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record the live Instagram reel link once posted manually
router.post("/:id/instagram-link", async (req, res) => {
  try {
    const { instagramReelUrl } = req.body;
    const clip = await getOwnedClip(req.params.id, req.user.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });
    if (!instagramReelUrl) return res.status(400).json({ error: "instagramReelUrl is required" });

    await pool.query(
      `UPDATE clips SET instagram_reel_url = $1, status = 'posted', updated_at = now() WHERE id = $2`,
      [instagramReelUrl, req.params.id]
    );

    const updatedResult = await pool.query("SELECT * FROM clips WHERE id = $1", [req.params.id]);
    res.json({ clip: updatedResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mark as submitted to clipster.gg (manual confirmation — no public API to automate this)
router.post("/:id/mark-submitted", async (req, res) => {
  try {
    const clip = await getOwnedClip(req.params.id, req.user.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });
    if (!clip.instagram_reel_url) {
      return res.status(400).json({ error: "Add the Instagram reel link before marking as submitted" });
    }

    await pool.query(
      `UPDATE clips SET submitted_to_clipster = true, submitted_at = now(), status = 'submitted', updated_at = now() WHERE id = $1`,
      [req.params.id]
    );

    const updatedResult = await pool.query("SELECT * FROM clips WHERE id = $1", [req.params.id]);
    res.json({ clip: updatedResult.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a clip (only the owner can delete their own clip)
router.delete("/:id", async (req, res) => {
  try {
    const clip = await getOwnedClip(req.params.id, req.user.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    await pool.query("DELETE FROM clips WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
