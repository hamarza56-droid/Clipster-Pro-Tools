import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import CampaignDetailPage from "./pages/CampaignDetailPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ParticleBackground from "./components/ParticleBackground.jsx";
import { api } from "./lib/api.js";

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [storageOk, setStorageOk] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));

    api
      .health()
      .then((data) => setStorageOk(data.storageConfigured))
      .catch(() => setStorageOk(false));
  }, []);

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    navigate("/login");
  }

  if (!authChecked) {
    return <div className="app-loading">Loading…</div>;
  }

  if (!user) {
    return (
      <>
        <ParticleBackground />
        <Routes>
          <Route path="*" element={<AuthPage onAuthenticated={setUser} />} />
        </Routes>
      </>
    );
  }

  return (
    <div className="app-shell">
      <ParticleBackground />
      <aside className="app-sidebar">
        <div className="app-logo">
          <span className="app-logo-dot" />
          <span className="app-logo-text">Pipeline</span>
        </div>

        <nav className="app-nav">
          <NavLink
            to="/"
            className={({ isActive }) => `app-nav-item${isActive ? " app-nav-item-active" : ""}`}
            end
          >
            Campaigns
          </NavLink>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user-row">
            <span className="app-user-name">{user.displayName || user.email}</span>
            <button className="app-logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
          {storageOk === false && (
            <div className="app-storage-warning">
              <span style={{ color: "var(--warning)" }}>●</span> Storage not configured
            </div>
          )}
          {storageOk === true && (
            <div className="app-storage-ok">
              <span style={{ color: "var(--accent)" }}>●</span> Storage connected
            </div>
          )}
        </div>
      </aside>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
