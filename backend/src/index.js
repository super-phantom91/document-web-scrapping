import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import { authMiddleware } from "./auth.js";
import { createCollaborationServer } from "./collaboration.js";
import { UPLOADS_DIR } from "./store.js";
import { initDb, isMysqlReady, pingMysql } from "./db.js";

const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, service: "docusync-api", mysql: await pingMysql() });
});

app.use("/api/auth", (req, res, next) => {
  if (req.path === "/login" || req.path === "/register") return next();
  return authMiddleware(req, res, next);
}, authRoutes);

app.use("/api/documents", authMiddleware, documentRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error." });
});

app.listen(PORT, async () => {
  console.log(`DocuSync API http://localhost:${PORT}`);
  try {
    await initDb();
  } catch (err) {
    console.error("MySQL connection failed:", err.message);
    console.error("Start MySQL and restart the API. Extracted name/category/images are stored in MySQL.");
  }
  if (!isMysqlReady()) {
    console.error("Extract will return an error until MySQL is available.");
  }
});

const collaboration = createCollaborationServer();
collaboration.listen().then(() => {
  console.log(`DocuSync collaboration ws://localhost:${collaboration.configuration.port}`);
});
