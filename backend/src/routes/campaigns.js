import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import path from "path";
import fs from "fs";
import db from "../db.js";
import { uploadFile } from "../services/storage.js";
import { ensureDir } from "../services/videoProcessor.js";

const router = express.Router();
const upload = multer({ dest: "uploads/tmp/" });

// List all campaigns
router.get("/", (req, res) => {
  const campaigns = db
    .prepare(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM clips WHERE campaign_id = c.id) as clip_count,
        (SELECT COUNT(*) FROM clips WHERE campaign_id = c.id AND submitted_to_clipster = 1) as submitted_count
       FROM campaigns c ORDER BY created_at DESC`
    )
    .all();
  res.json({ campaigns });
});

// Get one campaign with its clips
router.get("/:id", (req, res) => {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const clips = db
    .prepare("SELECT * FROM clips WHERE campaign_id = ? ORDER BY created_at DESC")
    .all(req.params.id);
  res.json({ campaign, clips });
});

// Create a campaign, optionally with a logo reference image
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

    db.prepare(
      `INSERT INTO campaigns (id, name, keyword, logo_reference_key, clipster_campaign_url, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, keyword, logoReferenceKey, clipsterCampaignUrl || null, notes || null);

    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
    res.status(201).json({ campaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update a campaign
router.put("/:id", (req, res) => {
  const { name, keyword, clipsterCampaignUrl, notes } = req.body;
  const existing = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Campaign not found" });

  db.prepare(
    `UPDATE campaigns SET name = ?, keyword = ?, clipster_campaign_url = ?, notes = ? WHERE id = ?`
  ).run(
    name ?? existing.name,
    keyword ?? existing.keyword,
    clipsterCampaignUrl ?? existing.clipster_campaign_url,
    notes ?? existing.notes,
    req.params.id
  );

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
  res.json({ campaign });
});

// Delete a campaign
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM clips WHERE campaign_id = ?").run(req.params.id);
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
