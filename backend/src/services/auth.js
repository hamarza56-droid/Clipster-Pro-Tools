import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import pool from "../db/index.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createUser({ email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = nanoid(12);

  await pool.query(
    `INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)`,
    [id, normalizedEmail, passwordHash, displayName || normalizedEmail.split("@")[0]]
  );

  return { id, email: normalizedEmail, displayName: displayName || normalizedEmail.split("@")[0] };
}

export async function verifyCredentials({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = result.rows[0];
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error("Invalid email or password.");
  }

  return { id: user.id, email: user.email, displayName: user.display_name };
}

export async function createSession(userId) {
  const sessionId = nanoid(32);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt]
  );

  return { sessionId, expiresAt };
}

export async function getUserBySession(sessionId) {
  if (!sessionId) return null;

  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [sessionId]
  );

  const row = result.rows[0];
  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
    return null;
  }

  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function deleteSession(sessionId) {
  if (!sessionId) return;
  await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}
