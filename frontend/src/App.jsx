import React, { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import CampaignDetailPage from "./pages/CampaignDetailPage.jsx";
import { api } from "./lib/api.js";

export default function App() {
  const [storageOk, setStorageOk] = useState(null);

  useEffect(() => {
    api
      .health()
      .then((data) => setStorageOk(data.storageConfigured))
      .catch(() => setStorageOk(false));
  }, []);

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoMark}>◆</span>
          <span style={styles.logoText}>PIPELINE</span>
        </div>

        <nav style={styles.nav}>
          <NavLink
            to="/"
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            Campaigns
          </NavLink>
        </nav>

        <div style={styles.sidebarFooter}>
          {storageOk === false && (
            <div style={styles.storageWarning}>
              <span style={{ color: "var(--warning)" }}>●</span> Storage not configured
            </div>
          )}
          {storageOk === true && (
            <div style={styles.storageOk}>
              <span style={{ color: "var(--accent)" }}>●</span> Storage connected
            </div>
          )}
        </div>
      </aside>

      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    minHeight: "100vh",
  },
  sidebar: {
    background: "var(--panel)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    padding: "24px 18px",
    position: "sticky",
    top: 0,
    height: "100vh",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "36px",
    padding: "0 6px",
  },
  logoMark: {
    color: "var(--accent)",
    fontSize: "14px",
  },
  logoText: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "15px",
    letterSpacing: "0.06em",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
  },
  navItem: {
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text-dim)",
  },
  navItemActive: {
    background: "var(--panel-raised)",
    color: "var(--text)",
  },
  sidebarFooter: {
    fontSize: "12px",
    color: "var(--text-dim)",
    padding: "0 6px",
  },
  storageWarning: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  storageOk: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  main: {
    padding: "40px 48px",
    maxWidth: "1100px",
  },
};
