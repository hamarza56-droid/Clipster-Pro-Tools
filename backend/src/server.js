import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

import campaignsRouter from "./routes/campaigns.js";
import clipsRouter from "./routes/clips.js";
import { isConfigured } from "./services/storage.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);
app.use(express.json());

// Ensure local working directories exist (gitignored but created fresh on boot)
["uploads/tmp", "exports", "data"].forEach((dir) => {
  const full = path.resolve(dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    storageConfigured: isConfigured(),
  });
});

app.use("/api/campaigns", campaignsRouter);
app.use("/api/clips", clipsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Clipster tool backend running on port ${PORT}`);
  if (!isConfigured()) {
    console.warn(
      "WARNING: R2 storage is not configured. Set R2_* env vars in .env before uploading clips."
    );
  }
});
