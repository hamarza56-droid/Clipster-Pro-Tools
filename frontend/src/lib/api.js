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

export const api = {
  // Campaigns
  listCampaigns: () => fetch(`${BASE}/campaigns`).then(handleResponse),

  getCampaign: (id) => fetch(`${BASE}/campaigns/${id}`).then(handleResponse),

  createCampaign: (formData) =>
    fetch(`${BASE}/campaigns`, { method: "POST", body: formData }).then(handleResponse),

  updateCampaign: (id, body) =>
    fetch(`${BASE}/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handleResponse),

  deleteCampaign: (id) =>
    fetch(`${BASE}/campaigns/${id}`, { method: "DELETE" }).then(handleResponse),

  // Clips
  uploadClip: (formData) =>
    fetch(`${BASE}/clips`, { method: "POST", body: formData }).then(handleResponse),

  uploadClipsBulk: (formData) =>
    fetch(`${BASE}/clips/bulk`, { method: "POST", body: formData }).then(handleResponse),

  startBulkProcess: (campaignId, options) =>
    fetch(`${BASE}/clips/bulk-process/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    }).then(handleResponse),

  getBulkStatus: (campaignId) =>
    fetch(`${BASE}/clips/bulk-status/${campaignId}`).then(handleResponse),

  detectLogo: (clipId) =>
    fetch(`${BASE}/clips/${clipId}/detect-logo`, { method: "POST" }).then(handleResponse),

  processClip: (clipId, formData) =>
    fetch(`${BASE}/clips/${clipId}/process`, { method: "POST", body: formData }).then(handleResponse),

  getPreviewUrl: (clipId, version = "export") =>
    fetch(`${BASE}/clips/${clipId}/preview?version=${version}`).then(handleResponse),

  setInstagramLink: (clipId, instagramReelUrl) =>
    fetch(`${BASE}/clips/${clipId}/instagram-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramReelUrl }),
    }).then(handleResponse),

  markSubmitted: (clipId) =>
    fetch(`${BASE}/clips/${clipId}/mark-submitted`, { method: "POST" }).then(handleResponse),

  deleteClip: (clipId) =>
    fetch(`${BASE}/clips/${clipId}`, { method: "DELETE" }).then(handleResponse),

  health: () => fetch(`${BASE}/health`).then(handleResponse),
};
