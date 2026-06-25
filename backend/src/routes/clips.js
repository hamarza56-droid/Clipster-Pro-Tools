import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import db from "../db.js";
import { uploadFile, downloadFile, getSignedFileUrl } from "../services/storage.js";
import { applyBackgroundSwap, ensureDir } from "../services/videoProcessor.js";
import { detectLogoInVideo } from "../services/logoDetector.js";

const router = express.Router();
const upload = multer({ dest: "uploads/tmp/" });
const uploadMultiple = multer({ dest: "uploads/tmp/" });

const TMP_DIR = path.resolve("uploads/tmp");
const EXPORTS_DIR = path.resolve("exports");
ensureDir(TMP_DIR);
ensureDir(EXPORTS_DIR);

// In-memory job tracker for bulk processing runs (per campaign).
// Not persisted across server restarts — that's fine, it's just live progress.
const bulkJobs = new Map(); // campaignId -> { total, completed, failed, running, results: [] }

// Upload multiple clips at once for a campaign
router.post("/bulk", uploadMultiple.array("videos", 50), async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: "campaignId and at least one video file are required" });
    }

    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const createdClips = [];

    for (const file of req.files) {
      try {
        const id = nanoid(10);
        const ext = path.extname(file.originalname) || ".mp4";
        const sourceKey = `clips/${id}/source${ext}`;

        await uploadFile(file.path, sourceKey, file.mimetype);

        db.prepare(
          `INSERT INTO clips (id, campaign_id, original_filename, source_key, status)
           VALUES (?, ?, ?, ?, 'uploaded')`
        ).run(id, campaignId, file.originalname, sourceKey);

        const localCopy = path.join(TMP_DIR, `${id}${ext}`);
        fs.copyFileSync(file.path, localCopy);
        fs.unlinkSync(file.path);

        createdClips.push(db.prepare("SELECT * FROM clips WHERE id = ?").get(id));
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

// Kick off background-swap processing for all "uploaded" (unprocessed) clips
// in a campaign, one at a time. Returns immediately; poll /bulk-status/:campaignId
// for progress.
router.post("/bulk-process/:campaignId", async (req, res) => {
  const { campaignId } = req.params;
  const { backgroundType = "color", backgroundValue = "#0a0a0a", scalePercent = 80 } = req.body;

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const existing = bulkJobs.get(campaignId);
  if (existing && existing.running) {
    return res.status(409).json({ error: "A bulk processing job is already running for this campaign" });
  }

  const pendingClips = db
    .prepare("SELECT * FROM clips WHERE campaign_id = ? AND status = 'uploaded'")
    .all(campaignId);

  if (pendingClips.length === 0) {
    return res.status(400).json({ error: "No unprocessed clips found for this campaign" });
  }

  const job = {
    total: pendingClips.length,
    completed: 0,
    failed: 0,
    running: true,
    results: [],
  };
  bulkJobs.set(campaignId, job);

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
          backgroundValue,
          scalePercent: Number(scalePercent),
        });

        const exportKey = `clips/${clip.id}/export.mp4`;
        await uploadFile(outputPath, exportKey, "video/mp4");

        db.prepare(
          `UPDATE clips SET export_key = ?, status = ?, background_type = ?, background_value = ?, updated_at = datetime('now') WHERE id = ?`
        ).run(exportKey, "processed", backgroundType, backgroundType === "color" ? backgroundValue : null, clip.id);

        job.completed++;
        job.results.push({ clipId: clip.id, filename: clip.original_filename, success: true });
      } catch (err) {
        console.error(`Bulk processing failed for clip ${clip.id}:`, err);
        job.failed++;
        job.results.push({ clipId: clip.id, filename: clip.original_filename, success: false, error: err.message });
      }
    }
    job.running = false;
  })();
});

// Poll progress of a bulk processing job
router.get("/bulk-status/:campaignId", (req, res) => {
  const job = bulkJobs.get(req.params.campaignId);
  if (!job) return res.json({ running: false, total: 0, completed: 0, failed: 0, results: [] });
  res.json(job);
});

// Upload a new clip for a campaign
router.post("/", upload.single("video"), async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId || !req.file) {
      return res.status(400).json({ error: "campaignId and video file are required" });
    }

    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const id = nanoid(10);
    const ext = path.extname(req.file.originalname) || ".mp4";
    const sourceKey = `clips/${id}/source${ext}`;

    await uploadFile(req.file.path, sourceKey, req.file.mimetype);

    db.prepare(
      `INSERT INTO clips (id, campaign_id, original_filename, source_key, status)
       VALUES (?, ?, ?, ?, 'uploaded')`
    ).run(id, campaignId, req.file.originalname, sourceKey);

    // Keep the local tmp copy briefly for the detect step the user will likely trigger next
    const localCopy = path.join(TMP_DIR, `${id}${ext}`);
    fs.copyFileSync(req.file.path, localCopy);
    fs.unlinkSync(req.file.path);

    const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(id);
    res.status(201).json({ clip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Run logo detection against the campaign's reference logo
router.post("/:id/detect-logo", async (req, res) => {
  try {
    const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(clip.campaign_id);
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

    db.prepare(
      `UPDATE clips SET logo_detected = ?, logo_confidence = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(result.detected ? 1 : 0, result.confidence, "logo-checked", clip.id);

    const updated = db.prepare("SELECT * FROM clips WHERE id = ?").get(clip.id);
    res.json({ clip: updated, detection: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Apply background swap and produce the export
router.post("/:id/process", upload.single("backgroundFile"), async (req, res) => {
  try {
    const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
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

    db.prepare(
      `UPDATE clips SET export_key = ?, status = ?, background_type = ?, background_value = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(exportKey, "processed", backgroundType, backgroundType === "color" ? backgroundValue : null, clip.id);

    const updated = db.prepare("SELECT * FROM clips WHERE id = ?").get(clip.id);
    const previewUrl = await getSignedFileUrl(exportKey, 3600);

    res.json({ clip: updated, previewUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get a signed preview URL for a clip's source or export
router.get("/:id/preview", async (req, res) => {
  try {
    const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
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
router.post("/:id/instagram-link", (req, res) => {
  const { instagramReelUrl } = req.body;
  const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
  if (!clip) return res.status(404).json({ error: "Clip not found" });
  if (!instagramReelUrl) return res.status(400).json({ error: "instagramReelUrl is required" });

  db.prepare(
    `UPDATE clips SET instagram_reel_url = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(instagramReelUrl, "posted", req.params.id);

  const updated = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
  res.json({ clip: updated });
});

// Mark as submitted to clipster.gg (manual confirmation — no public API to automate this)
router.post("/:id/mark-submitted", (req, res) => {
  const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
  if (!clip) return res.status(404).json({ error: "Clip not found" });
  if (!clip.instagram_reel_url) {
    return res.status(400).json({ error: "Add the Instagram reel link before marking as submitted" });
  }

  db.prepare(
    `UPDATE clips SET submitted_to_clipster = 1, submitted_at = datetime('now'), status = 'submitted', updated_at = datetime('now') WHERE id = ?`
  ).run(req.params.id);

  const updated = db.prepare("SELECT * FROM clips WHERE id = ?").get(req.params.id);
  res.json({ clip: updated });
});

// Delete a clip
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM clips WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
