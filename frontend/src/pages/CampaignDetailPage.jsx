import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import ClipCard from "../components/ClipCard.jsx";

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);

  // Bulk process panel state
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkBackgroundType, setBulkBackgroundType] = useState("color");
  const [bulkBackgroundColor, setBulkBackgroundColor] = useState("#0a0a0a");
  const [bulkBackgroundImage, setBulkBackgroundImage] = useState(null);
  const [bulkScalePercent, setBulkScalePercent] = useState(80);
  const [bulkJob, setBulkJob] = useState(null);
  const pollRef = useRef(null);

  function load() {
    setLoading(true);
    api
      .getCampaign(id)
      .then((data) => {
        setCampaign(data.campaign);
        setClips(data.clips);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("campaignId", id);
      formData.append("video", file);
      const result = await api.uploadClip(formData);
      setClips((prev) => [result.clip, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleBulkUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("campaignId", id);
      files.forEach((f) => formData.append("videos", f));
      const result = await api.uploadClipsBulk(formData);
      setClips((prev) => [...result.clips, ...prev]);
      if (result.uploadedCount < result.requestedCount) {
        setError(
          `${result.uploadedCount} of ${result.requestedCount} files uploaded — some failed. Check filenames/formats and retry those.`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    }
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getBulkStatus(id);
        setBulkJob(status);
        if (!status.running) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          load(); // refresh clip list to show updated statuses
        }
      } catch (err) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
  }

  async function handleStartBulkProcess() {
    setError(null);
    if (bulkBackgroundType === "image" && !bulkBackgroundImage) {
      setError("Choose a background image before starting bulk processing.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("backgroundType", bulkBackgroundType);
      formData.append("scalePercent", bulkScalePercent);
      if (bulkBackgroundType === "color") {
        formData.append("backgroundValue", bulkBackgroundColor);
      } else if (bulkBackgroundType === "image" && bulkBackgroundImage) {
        formData.append("backgroundFile", bulkBackgroundImage);
      }
      const result = await api.startBulkProcess(id, formData);
      setBulkJob({ running: true, total: result.total, completed: 0, failed: 0, results: [] });
      startPolling();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleClipUpdated(updatedClip) {
    setClips((prev) => prev.map((c) => (c.id === updatedClip.id ? updatedClip : c)));
  }

  function handleClipDeleted(clipId) {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
  }

  if (loading) return <div style={{ color: "var(--text-dim)" }}>Loading campaign…</div>;
  if (!campaign) return <div style={{ color: "var(--text-dim)" }}>Campaign not found.</div>;

  const pendingCount = clips.filter((c) => c.status === "uploaded").length;

  return (
    <div>
      <Link to="/" style={styles.backLink}>
        ← All campaigns
      </Link>

      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{campaign.name}</h1>
          <div style={styles.metaRow}>
            <span style={styles.keyword}>#{campaign.keyword}</span>
            {campaign.clipster_campaign_url && (
              <a href={campaign.clipster_campaign_url} target="_blank" rel="noreferrer" style={styles.metaLink}>
                clipster.gg campaign ↗
              </a>
            )}
          </div>
        </div>

        <div style={styles.headerActions}>
          <label style={styles.secondaryUploadBtn}>
            {uploading ? "Uploading…" : "+ Upload clip"}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <label style={styles.uploadBtn}>
            {uploading ? "Uploading…" : "+ Bulk upload"}
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="video/*"
              multiple
              style={{ display: "none" }}
              onChange={handleBulkUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </header>

      {!campaign.logo_reference_key && (
        <div style={styles.warningBanner}>
          No logo reference image set for this campaign — the logo-check step won't work until you
          add one.
        </div>
      )}

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Bulk processing panel */}
      <div style={styles.bulkPanel}>
        <div style={styles.bulkPanelHeader} onClick={() => setShowBulkPanel((s) => !s)}>
          <span style={styles.bulkPanelTitle}>
            Bulk apply background {pendingCount > 0 && `(${pendingCount} clip${pendingCount === 1 ? "" : "s"} waiting)`}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: "13px" }}>{showBulkPanel ? "▴" : "▾"}</span>
        </div>

        {showBulkPanel && (
          <div style={styles.bulkPanelBody}>
            <p style={styles.hint}>
              Applies one background setting to every uploaded-but-unprocessed clip in this
              campaign. Clips are processed one at a time on the server — this runs in the
              background, so you can leave this page and check back.
            </p>

            <div style={styles.row}>
              <label style={styles.smallLabel}>
                Background type
                <select value={bulkBackgroundType} onChange={(e) => setBulkBackgroundType(e.target.value)}>
                  <option value="color">Solid color</option>
                  <option value="blur">Blurred copy of clip</option>
                  <option value="image">Custom image</option>
                </select>
              </label>

              {bulkBackgroundType === "color" && (
                <label style={styles.smallLabel}>
                  Color
                  <input
                    type="color"
                    value={bulkBackgroundColor}
                    onChange={(e) => setBulkBackgroundColor(e.target.value)}
                  />
                </label>
              )}

              {bulkBackgroundType === "image" && (
                <label style={styles.smallLabel}>
                  Image (used for every clip in this batch)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBulkBackgroundImage(e.target.files[0] || null)}
                  />
                </label>
              )}

              <label style={styles.smallLabel}>
                Clip size on canvas: {bulkScalePercent}%
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={bulkScalePercent}
                  onChange={(e) => setBulkScalePercent(e.target.value)}
                />
              </label>
            </div>

            <p style={styles.hint}>
              Note: custom video backgrounds aren't available in bulk mode yet (they're the
              heaviest option to process) — use color, blur, or image for batches, or process a
              video background individually via "Manage" on a clip.
            </p>

            <button
              style={styles.primaryBtn}
              disabled={pendingCount === 0 || (bulkJob && bulkJob.running)}
              onClick={handleStartBulkProcess}
            >
              {bulkJob && bulkJob.running
                ? "Processing…"
                : pendingCount === 0
                ? "No clips waiting"
                : `Process ${pendingCount} clip${pendingCount === 1 ? "" : "s"}`}
            </button>

            {bulkJob && (
              <div style={styles.progressArea}>
                <div style={styles.progressBarOuter}>
                  <div
                    style={{
                      ...styles.progressBarInner,
                      width: `${bulkJob.total > 0 ? ((bulkJob.completed + bulkJob.failed) / bulkJob.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div style={styles.progressText}>
                  {bulkJob.completed + bulkJob.failed} / {bulkJob.total} done
                  {bulkJob.failed > 0 && <span style={{ color: "var(--danger)" }}> · {bulkJob.failed} failed</span>}
                  {!bulkJob.running && <span style={{ color: "var(--accent)" }}> · finished</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {clips.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ color: "var(--text-dim)", margin: 0 }}>
            No clips uploaded yet for this campaign.
          </p>
        </div>
      ) : (
        <div style={styles.clipList}>
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              campaign={campaign}
              onUpdated={handleClipUpdated}
              onDeleted={handleClipDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  backLink: {
    fontSize: "13px",
    color: "var(--text-dim)",
    display: "inline-block",
    marginBottom: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    margin: 0,
  },
  metaRow: {
    display: "flex",
    gap: "14px",
    marginTop: "8px",
    alignItems: "center",
  },
  keyword: {
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    color: "var(--accent)",
  },
  metaLink: {
    fontSize: "13px",
    color: "var(--text-dim)",
  },
  headerActions: {
    display: "flex",
    gap: "10px",
  },
  uploadBtn: {
    background: "linear-gradient(120deg, var(--violet), var(--pink))",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 6px 20px -6px rgba(139, 92, 246, 0.5)",
  },
  secondaryUploadBtn: {
    background: "var(--panel-raised)",
    color: "var(--text)",
    border: "1px solid var(--border-light)",
    borderRadius: "8px",
    padding: "10px 16px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  warningBanner: {
    background: "var(--warning-dim)",
    color: "var(--warning)",
    padding: "10px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "18px",
  },
  errorBanner: {
    background: "var(--danger-dim)",
    color: "var(--danger)",
    padding: "10px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    marginBottom: "18px",
  },
  bulkPanel: {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    marginBottom: "20px",
    overflow: "hidden",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
  },
  bulkPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    cursor: "pointer",
  },
  bulkPanelTitle: {
    fontWeight: 600,
    fontSize: "14px",
  },
  bulkPanelBody: {
    padding: "0 18px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    borderTop: "1px solid var(--border)",
    paddingTop: "16px",
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-faint)",
    margin: 0,
    lineHeight: 1.5,
  },
  row: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  smallLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontSize: "12px",
    color: "var(--text-dim)",
  },
  primaryBtn: {
    background: "linear-gradient(120deg, var(--violet), var(--pink))",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    alignSelf: "flex-start",
    boxShadow: "0 6px 20px -6px rgba(139, 92, 246, 0.5)",
  },
  progressArea: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  progressBarOuter: {
    height: "8px",
    borderRadius: "4px",
    background: "var(--border)",
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    background: "linear-gradient(90deg, var(--violet), var(--pink))",
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: "12px",
    color: "var(--text-dim)",
  },
  emptyState: {
    border: "1px dashed var(--border-light)",
    borderRadius: "10px",
    padding: "40px",
    textAlign: "center",
  },
  clipList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
};
