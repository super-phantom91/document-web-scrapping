import jwt from "jsonwebtoken";
import { findUserById, publicUser } from "./store.js";

export const JWT_SECRET = process.env.JWT_SECRET || "docusync-dev-secret-change-me";

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in required." });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session." });

  const user = findUserById(payload.sub);
  if (!user) return res.status(401).json({ error: "Account not found." });

  req.user = publicUser(user);
  next();
}
