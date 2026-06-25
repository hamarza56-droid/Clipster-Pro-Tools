import React, { useState } from "react";
import StageTracker from "./StageTracker.jsx";
import { api } from "../lib/api.js";

export default function ClipCard({ clip, campaign, onUpdated, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // Background swap controls
  const [backgroundType, setBackgroundType] = useState("color");
  const [backgroundColor, setBackgroundColor] = useState("#0a0a0a");
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [scalePercent, setScalePercent] = useState(80);

  // Instagram link
  const [igLink, setIgLink] = useState(clip.instagram_reel_url || "");

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleDetectLogo() {
    run(async () => {
      const result = await api.detectLogo(clip.id);
      onUpdated(result.clip);
    });
  }

  function handleProcess() {
    run(async () => {
      const formData = new FormData();
      formData.append("backgroundType", backgroundType);
      formData.append("scalePercent", scalePercent);
      if (backgroundType === "color") {
        formData.append("backgroundValue", backgroundColor);
      } else if (backgroundFile) {
        formData.append("backgroundFile", backgroundFile);
      }
      const result = await api.processClip(clip.id, formData);
      onUpdated(result.clip);
      setPreviewUrl(result.previewUrl);
    });
  }

  function handleLoadPreview() {
    run(async () => {
      const result = await api.getPreviewUrl(clip.id);
      setPreviewUrl(result.url);
    });
  }

  function handleSaveLink() {
    run(async () => {
      const result = await api.setInstagramLink(clip.id, igLink);
      onUpdated(result.clip);
    });
  }

  function handleMarkSubmitted() {
    run(async () => {
      const result = await api.markSubmitted(clip.id);
      onUpdated(result.clip);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this clip? This can't be undone.")) return;
    run(async () => {
      await api.deleteClip(clip.id);
      onDeleted(clip.id);
    });
  }

  const logoChecked = clip.status !== "uploaded";
  const logoBadge = clip.logo_detected
    ? { text: `Logo detected (${Math.round((clip.logo_confidence || 0) * 100)}%)`, color: "var(--accent)" }
    : logoChecked
    ? { text: `Logo not confirmed (${Math.round((clip.logo_confidence || 0) * 100)}%)`, color: "var(--warning)" }
    : null;

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <div>
          <div style={styles.filename}>{clip.original_filename}</div>
          <StageTracker status={clip.status} />
        </div>
        <button style={styles.expandBtn} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Collapse" : "Manage"}
        </button>
      </div>

      {logoBadge && (
        <div style={{ ...styles.badge, color: logoBadge.color, borderColor: logoBadge.color }}>
          {logoBadge.text}
        </div>
      )}

      {error && <div style={styles.errorBanner}>{error}</div>}

      {expanded && (
        <div style={styles.expandedArea}>
          {/* Step 1: Logo detection */}
          <Section title="1. Verify campaign logo">
            <p style={styles.hint}>
              Checks extracted frames against this campaign's reference logo image. This is a
              best-effort visual match, not pixel-perfect — always glance at the clip yourself
              before submitting.
            </p>
            <button style={styles.secondaryBtn} disabled={busy} onClick={handleDetectLogo}>
              {busy ? "Working…" : "Run logo check"}
            </button>
          </Section>

          {/* Step 2: Background swap */}
          <Section title="2. Apply background">
            <div style={styles.row}>
              <label style={styles.smallLabel}>
                Background type
                <select value={backgroundType} onChange={(e) => setBackgroundType(e.target.value)}>
                  <option value="color">Solid color</option>
                  <option value="blur">Blurred copy of clip</option>
                  <option value="image">Custom image</option>
                  <option value="video">Custom video (looped)</option>
                </select>
              </label>

              {backgroundType === "color" && (
                <label style={styles.smallLabel}>
                  Color
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                  />
                </label>
              )}

              {(backgroundType === "image" || backgroundType === "video") && (
                <label style={styles.smallLabel}>
                  File
                  <input
                    type="file"
                    accept={backgroundType === "image" ? "image/*" : "video/*"}
                    onChange={(e) => setBackgroundFile(e.target.files[0])}
                  />
                </label>
              )}

              <label style={styles.smallLabel}>
                Clip size on canvas: {scalePercent}%
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={scalePercent}
                  onChange={(e) => setScalePercent(e.target.value)}
                />
              </label>
            </div>
            <button style={styles.secondaryBtn} disabled={busy} onClick={handleProcess}>
              {busy ? "Processing…" : "Apply background & export"}
            </button>
          </Section>

          {/* Preview */}
          <Section title="Preview">
            <button style={styles.secondaryBtn} disabled={busy} onClick={handleLoadPreview}>
              Load preview link
            </button>
            {previewUrl && (
              <video src={previewUrl} controls style={styles.previewVideo} />
            )}
          </Section>

          {/* Step 3: Posting + submission tracking */}
          <Section title="3. Post manually, then log the link">
            <p style={styles.hint}>
              Download the export above and post it to Instagram yourself. Once it's live, paste
              the reel link here — this app doesn't post on your behalf.
            </p>
            <div style={styles.row}>
              <input
                style={{ flex: 1 }}
                placeholder="https://instagram.com/reel/…"
                value={igLink}
                onChange={(e) => setIgLink(e.target.value)}
              />
              <button style={styles.secondaryBtn} disabled={busy || !igLink} onClick={handleSaveLink}>
                Save link
              </button>
            </div>
          </Section>

          <Section title="4. Submit to clipster.gg">
            <p style={styles.hint}>
              {campaign?.clipster_campaign_url ? (
                <>
                  Open the campaign on clipster.gg and submit the reel link manually, then confirm
                  here.{" "}
                  <a
                    href={campaign.clipster_campaign_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    Open campaign ↗
                  </a>
                </>
              ) : (
                "No clipster.gg campaign URL saved for this campaign — add one to get a direct link here."
              )}
            </p>
            <button
              style={styles.primaryBtn}
              disabled={busy || !clip.instagram_reel_url || clip.submitted_to_clipster}
              onClick={handleMarkSubmitted}
            >
              {clip.submitted_to_clipster ? "✓ Submitted" : "Mark as submitted"}
            </button>
          </Section>

          <button style={styles.deleteBtn} disabled={busy} onClick={handleDelete}>
            Delete clip
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "16px 18px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  filename: {
    fontWeight: 600,
    fontSize: "14px",
    marginBottom: "4px",
  },
  expandBtn: {
    background: "transparent",
    border: "1px solid var(--border-light)",
    color: "var(--text-dim)",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    cursor: "pointer",
  },
  badge: {
    display: "inline-block",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    border: "1px solid",
    borderRadius: "4px",
    padding: "3px 8px",
    marginTop: "6px",
  },
  expandedArea: {
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-faint)",
    margin: 0,
    lineHeight: 1.5,
  },
  row: {
    display: "flex",
    gap: "12px",
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
  secondaryBtn: {
    background: "var(--panel-raised)",
    border: "1px solid var(--border-light)",
    color: "var(--text)",
    borderRadius: "6px",
    padding: "9px 14px",
    fontSize: "13px",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  primaryBtn: {
    background: "var(--accent)",
    color: "#06150c",
    border: "none",
    borderRadius: "6px",
    padding: "9px 14px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  deleteBtn: {
    background: "transparent",
    border: "1px solid var(--danger-dim)",
    color: "var(--danger)",
    borderRadius: "6px",
    padding: "8px 14px",
    fontSize: "12px",
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  previewVideo: {
    maxWidth: "240px",
    borderRadius: "8px",
    border: "1px solid var(--border-light)",
  },
  errorBanner: {
    background: "var(--danger-dim)",
    color: "var(--danger)",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "12px",
    marginTop: "8px",
  },
};
