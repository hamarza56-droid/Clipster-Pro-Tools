import { getUserBySession } from "../services/auth.js";

export async function requireAuth(req, res, next) {
  try {
    const sessionId = req.cookies?.session_id;
    const user = await getUserBySession(sessionId);

    if (!user) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication check failed." });
  }
}
