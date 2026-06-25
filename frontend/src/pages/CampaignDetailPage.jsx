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

  function handleClipUpdated(updatedClip) {
    setClips((prev) => prev.map((c) => (c.id === updatedClip.id ? updatedClip : c)));
  }

  function handleClipDeleted(clipId) {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
  }

  if (loading) return <div style={{ color: "var(--text-dim)" }}>Loading campaign…</div>;
  if (!campaign) return <div style={{ color: "var(--text-dim)" }}>Campaign not found.</div>;

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

        <label style={styles.uploadBtn}>
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
      </header>

      {!campaign.logo_reference_key && (
        <div style={styles.warningBanner}>
          No logo reference image set for this campaign — the logo-check step won't work until you
          add one.
        </div>
      )}

      {error && <div style={styles.errorBanner}>{error}</div>}

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
  uploadBtn: {
    background: "var(--accent)",
    color: "#06150c",
    border: "none",
    borderRadius: "6px",
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
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
