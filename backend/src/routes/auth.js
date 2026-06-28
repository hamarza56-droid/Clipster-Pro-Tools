import express from "express";
import { createUser, verifyCredentials, createSession, deleteSession } from "../services/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  // Cross-site cookies (frontend and backend on different Render subdomains)
  // require sameSite: "none", which in turn requires secure: true — browsers
  // reject "none" cookies over plain HTTP. Render serves everything over
  // HTTPS, so this is safe in both production and this deployment's preview.
  secure: true,
  sameSite: "none",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

router.post("/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const user = await createUser({ email, password, displayName });
    const { sessionId } = await createSession(user.id);

    res.cookie("session_id", sessionId, COOKIE_OPTIONS);
    res.status(201).json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await verifyCredentials({ email, password });
    const { sessionId } = await createSession(user.id);

    res.cookie("session_id", sessionId, COOKIE_OPTIONS);
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/logout", async (req, res) => {
  const sessionId = req.cookies?.session_id;
  await deleteSession(sessionId);
  res.clearCookie("session_id", COOKIE_OPTIONS);
  res.status(204).send();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
