import { Router } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { signToken } from "../auth.js";
import { createUser, findUserByUsername, publicUser } from "../store.js";

const router = Router();

const COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#4f46e5"];

function colorForName(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

router.post("/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (username.length < 2 || username.length > 32) {
    return res.status(400).json({ error: "Username must be 2–32 characters." });
  }
  if (!/^[a-zA-Z0-9_\-.]+$/.test(username)) {
    return res.status(400).json({ error: "Username can only contain letters, numbers, and _-." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (findUserByUsername(username)) {
    return res.status(409).json({ error: "That username is already taken." });
  }

  const user = createUser({
    id: uuid(),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    color: colorForName(username),
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const user = findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", (req, res) => {
  res.json({ user: req.user });
});

export default router;
