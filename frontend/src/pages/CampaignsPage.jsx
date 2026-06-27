import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api
      .listCampaigns()
      .then((data) => setCampaigns(data.campaigns))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Campaigns</h1>
          <p style={styles.subtitle}>Track sponsor keywords, clip submissions, and pipeline status.</p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New campaign"}
        </button>
      </header>

      {showForm && (
        <NewCampaignForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {error && <div style={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div style={styles.dim}>Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ color: "var(--text-dim)", margin: 0 }}>
            No campaigns yet. Add one to start tracking clips against a sponsor keyword.
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {campaigns.map((c) => (
            <Link to={`/campaigns/${c.id}`} key={c.id} style={styles.card}>
              <div style={styles.cardTop}>
                <span style={styles.cardName}>{c.name}</span>
                <span style={styles.keyword}>#{c.keyword}</span>
              </div>
              <div style={styles.cardStats}>
                <span>
                  <strong style={{ color: "var(--text)" }}>{c.clip_count}</strong> clips
                </span>
                <span>
                  <strong style={{ color: "var(--accent)" }}>{c.submitted_count}</strong> submitted
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewCampaignForm({ onCreated }) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [clipsterCampaignUrl, setClipsterCampaignUrl] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("keyword", keyword);
      formData.append("clipsterCampaignUrl", clipsterCampaignUrl);
      if (logoFile) formData.append("logoReference", logoFile);
      await api.createCampaign(formData);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formRow}>
        <label style={styles.label}>
          Campaign name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cs2skin.com"
            required
          />
        </label>
        <label style={styles.label}>
          Keyword
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="cs2skincom"
            required
          />
        </label>
      </div>
      <div style={styles.formRow}>
        <label style={styles.label}>
          Clipster.gg campaign URL (optional)
          <input
            value={clipsterCampaignUrl}
            onChange={(e) => setClipsterCampaignUrl(e.target.value)}
            placeholder="https://clipster.gg/campaigns/…"
          />
        </label>
        <label style={styles.label}>
          Logo reference image
          <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} />
        </label>
      </div>
      <p style={styles.hint}>
        Upload a clean image of the campaign's logo. Clips will be checked against this reference to
        confirm the logo is visible before you submit.
      </p>
      {error && <div style={styles.errorBanner}>{error}</div>}
      <button type="submit" style={styles.primaryBtn} disabled={submitting}>
        {submitting ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "26px",
    fontWeight: 700,
    margin: 0,
  },
  subtitle: {
    color: "var(--text-dim)",
    fontSize: "14px",
    marginTop: "6px",
  },
  primaryBtn: {
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
  dim: {
    color: "var(--text-dim)",
  },
  emptyState: {
    border: "1px dashed var(--border-light)",
    borderRadius: "12px",
    padding: "40px",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "14px",
  },
  card: {
    display: "block",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "18px",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
    transition: "border-color 0.2s ease, transform 0.2s ease",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "14px",
  },
  cardName: {
    fontWeight: 600,
    fontSize: "15px",
  },
  keyword: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--accent)",
  },
  cardStats: {
    display: "flex",
    gap: "16px",
    fontSize: "13px",
    color: "var(--text-dim)",
  },
  form: {
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    color: "var(--text-dim)",
  },
  hint: {
    fontSize: "12px",
    color: "var(--text-faint)",
    margin: 0,
  },
  errorBanner: {
    background: "var(--danger-dim)",
    color: "var(--danger)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    border: "1px solid rgba(255, 107, 107, 0.25)",
  },
};
