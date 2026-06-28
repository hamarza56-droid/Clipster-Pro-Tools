import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import pool from "../db/index.js";
import { uploadFile } from "../services/storage.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/tmp/" });

router.use(requireAuth);

// List all campaigns. Counts are team-wide (campaigns are shared), but the
// clip list itself (fetched per-campaign below) is scoped to the requester.
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM clips WHERE campaign_id = c.id) AS clip_count,
        (SELECT COUNT(*) FROM clips WHERE campaign_id = c.id AND submitted_to_clipster = true) AS submitted_count,
        (SELECT COUNT(*) FROM clips WHERE campaign_id = c.id AND user_id = $1) AS my_clip_count
      FROM campaigns c
      ORDER BY created_at DESC
    `, [req.user.id]);
    res.json({ campaigns: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get one campaign with only the requesting user's own clips.
router.get("/:id", async (req, res) => {
  try {
    const campaignResult = await pool.query("SELECT * FROM campaigns WHERE id = $1", [req.params.id]);
    const campaign = campaignResult.rows[0];
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const clipsResult = await pool.query(
      "SELECT * FROM clips WHERE campaign_id = $1 AND user_id = $2 ORDER BY created_at DESC",
      [req.params.id, req.user.id]
    );

    res.json({ campaign, clips: clipsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create a campaign (shared — visible to all users once created)
router.post("/", upload.single("logoReference"), async (req, res) => {
  try {
    const { name, keyword, clipsterCampaignUrl, notes } = req.body;
    if (!name || !keyword) {
      return res.status(400).json({ error: "name and keyword are required" });
    }

    const id = nanoid(10);
    let logoReferenceKey = null;

    if (req.file) {
      const ext = path.extname(req.file.originalname) || ".png";
      logoReferenceKey = `campaigns/${id}/logo-reference${ext}`;
      await uploadFile(req.file.path, logoReferenceKey, req.file.mimetype);
      fs.unlinkSync(req.file.path);
    }

    await pool.query(
      `INSERT INTO campaigns (id, name, keyword, logo_reference_key, clipster_campaign_url, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, name, keyword, logoReferenceKey, clipsterCampaignUrl || null, notes || null, req.user.id]
    );

    const result = await pool.query("SELECT * FROM campaigns WHERE id = $1", [id]);
    res.status(201).json({ campaign: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update a campaign (any team member can edit shared campaign metadata)
router.put("/:id", async (req, res) => {
  try {
    const { name, keyword, clipsterCampaignUrl, notes } = req.body;
    const existingResult = await pool.query("SELECT * FROM campaigns WHERE id = $1", [req.params.id]);
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: "Campaign not found" });

    await pool.query(
      `UPDATE campaigns SET name = $1, keyword = $2, clipster_campaign_url = $3, notes = $4 WHERE id = $5`,
      [
        name ?? existing.name,
        keyword ?? existing.keyword,
        clipsterCampaignUrl ?? existing.clipster_campaign_url,
        notes ?? existing.notes,
        req.params.id,
      ]
    );

    const result = await pool.query("SELECT * FROM campaigns WHERE id = $1", [req.params.id]);
    res.json({ campaign: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a campaign (and all clips within it, across all users)
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM clips WHERE campaign_id = $1", [req.params.id]);
    await pool.query("DELETE FROM campaigns WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
