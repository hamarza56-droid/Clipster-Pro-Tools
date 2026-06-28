const BASE = `${import.meta.env.VITE_API_BASE || ""}/api`;

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Every request must include credentials, or the session cookie never gets
 * sent to/from the backend (it lives on a different subdomain than the
 * frontend on Render — cross-origin cookies require this explicitly).
 */
function authFetch(url, options = {}) {
  return fetch(url, { ...options, credentials: "include" });
}

export const api = {
  // Auth
  signup: ({ email, password, displayName }) =>
    authFetch(`${BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    }).then(handleResponse),

  login: ({ email, password }) =>
    authFetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(handleResponse),

  logout: () => authFetch(`${BASE}/auth/logout`, { method: "POST" }).then(handleResponse),

  me: () => authFetch(`${BASE}/auth/me`).then(handleResponse),

  // Campaigns
  listCampaigns: () => authFetch(`${BASE}/campaigns`).then(handleResponse),

  getCampaign: (id) => authFetch(`${BASE}/campaigns/${id}`).then(handleResponse),

  createCampaign: (formData) =>
    authFetch(`${BASE}/campaigns`, { method: "POST", body: formData }).then(handleResponse),

  updateCampaign: (id, body) =>
    authFetch(`${BASE}/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse),

  deleteCampaign: (id) =>
    authFetch(`${BASE}/campaigns/${id}`, { method: "DELETE" }).then(handleResponse),

  // Clips
  uploadClip: (formData) =>
    authFetch(`${BASE}/clips`, { method: "POST", body: formData }).then(handleResponse),

  uploadClipsBulk: (formData) =>
    authFetch(`${BASE}/clips/bulk`, { method: "POST", body: formData }).then(handleResponse),

  startBulkProcess: (campaignId, formData) =>
    authFetch(`${BASE}/clips/bulk-process/${campaignId}`, {
      method: "POST",
      body: formData,
    }).then(handleResponse),

  getBulkStatus: (campaignId) =>
    authFetch(`${BASE}/clips/bulk-status/${campaignId}`).then(handleResponse),

  detectLogo: (clipId) =>
    authFetch(`${BASE}/clips/${clipId}/detect-logo`, { method: "POST" }).then(handleResponse),

  processClip: (clipId, formData) =>
    authFetch(`${BASE}/clips/${clipId}/process`, { method: "POST", body: formData }).then(handleResponse),

  getPreviewUrl: (clipId, version = "export") =>
    authFetch(`${BASE}/clips/${clipId}/preview?version=${version}`).then(handleResponse),

  setInstagramLink: (clipId, instagramReelUrl) =>
    authFetch(`${BASE}/clips/${clipId}/instagram-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramReelUrl }),
    }).then(handleResponse),

  markSubmitted: (clipId) =>
    authFetch(`${BASE}/clips/${clipId}/mark-submitted`, { method: "POST" }).then(handleResponse),

  deleteClip: (clipId) =>
    authFetch(`${BASE}/clips/${clipId}`, { method: "DELETE" }).then(handleResponse),

  health: () => authFetch(`${BASE}/health`).then(handleResponse),
};
