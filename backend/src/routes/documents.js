import { Router } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import multer from "multer";
import mammoth from "mammoth";
import {
  addDocumentMember,
  canAccessDocument,
  createDocument,
  deleteDocument,
  findUserByUsername,
  getDocument,
  listDocumentsForUser,
  publicDocument,
  removeDocumentMember,
  updateDocument,
  UPLOADS_DIR,
} from "../store.js";
import { extractDocument } from "../extractorClient.js";
import { isMysqlReady, mysqlLocation } from "../db.js";
import { deleteExtraction, getExtraction, saveExtraction } from "../extractions.js";

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${uuid()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function canAccess(doc, user) {
  return canAccessDocument(doc, user.id);
}

function canManage(doc, user) {
  return doc.ownerId === user.id;
}

function sendDoc(res, doc, user, status = 200) {
  res.status(status).json({ document: publicDocument(doc, user.id) });
}

router.get("/", (req, res) => {
  res.json({ documents: listDocumentsForUser(req.user.id) });
});

router.post("/", (req, res) => {
  const title = String(req.body?.title || "Untitled document").trim() || "Untitled document";
  const doc = createDocument({
    id: uuid(),
    title,
    ownerId: req.user.id,
    ownerName: req.user.username,
    memberIds: [],
    visibility: "link",
    initialHtml: "<h1></h1><p></p>",
    docxPath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json({ document: publicDocument(doc, req.user.id) });
});

router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a .docx file to import." });
  if (!req.file.originalname.toLowerCase().endsWith(".docx")) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Only .docx files can be imported." });
  }

  try {
    const result = await mammoth.convertToHtml({ path: req.file.path });
    const title = path.basename(req.file.originalname, ".docx");
    const doc = createDocument({
      id: uuid(),
      title,
      ownerId: req.user.id,
      ownerName: req.user.username,
      memberIds: [],
      visibility: "link",
      initialHtml: result.value || "<p></p>",
      docxPath: req.file.path,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    res.status(201).json({ document: publicDocument(doc, req.user.id) });
  } catch (err) {
    return res.status(422).json({ error: `Could not import DOCX: ${err.message}` });
  }
});

router.get("/:id", (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!canAccess(doc, req.user)) return res.status(403).json({ error: "You do not have access to this document." });
  const opened = addDocumentMember(doc.id, req.user.id) || doc;
  sendDoc(res, opened, req.user);
});

router.post("/:id/share", (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!canAccess(doc, req.user)) return res.status(403).json({ error: "You cannot share this document." });

  const username = String(req.body?.username || "").trim();
  if (!username) return res.status(400).json({ error: "Enter a username to invite." });
  const invitee = findUserByUsername(username);
  if (!invitee) return res.status(404).json({ error: "No account with that username." });
  if (invitee.id === doc.ownerId) return res.status(400).json({ error: "That person already owns this document." });

  const updated = addDocumentMember(doc.id, invitee.id) || doc;
  sendDoc(res, updated, req.user);
});

router.delete("/:id/share/:userId", (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!canManage(doc, req.user)) return res.status(403).json({ error: "Only the owner can remove people." });
  if (req.params.userId === doc.ownerId) return res.status(400).json({ error: "The owner cannot be removed." });
  const updated = removeDocumentMember(doc.id, req.params.userId) || doc;
  sendDoc(res, updated, req.user);
});

router.patch("/:id", (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!canAccess(doc, req.user)) return res.status(403).json({ error: "You cannot edit this document." });

  const patch = {};
  if (typeof req.body?.title === "string") {
    patch.title = req.body.title.trim() || "Untitled document";
  }
  if (typeof req.body?.initialHtml === "string") {
    patch.initialHtml = req.body.initialHtml;
  }
  if (req.body?.visibility === "link" || req.body?.visibility === "private") {
    if (!canManage(doc, req.user)) {
      return res.status(403).json({ error: "Only the owner can change link sharing." });
    }
    patch.visibility = req.body.visibility;
  }
  const updated = updateDocument(doc.id, patch);
  sendDoc(res, updated, req.user);
});

router.delete("/:id", async (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (doc.ownerId !== req.user.id) return res.status(403).json({ error: "Only the owner can delete this document." });
  if (isMysqlReady()) {
    await deleteExtraction(doc.id);
  }
  deleteDocument(doc.id);
  res.json({ ok: true });
});

router.get("/:id/extraction", async (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!canAccess(doc, req.user)) return res.status(403).json({ error: "You do not have access to this document." });
  if (!isMysqlReady()) {
    return res.status(503).json({ error: "MySQL is not connected. Start MySQL so extracted fields can be stored." });
  }
  const extraction = await getExtraction(doc.id);
  res.json({ extraction, mysql: extraction ? { ...mysqlLocation(), document_id: doc.id, extraction_id: extraction.id } : mysqlLocation() });
});

router.post("/:id/extract", async (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (!canAccess(doc, req.user)) return res.status(403).json({ error: "You do not have access to this document." });
  if (!isMysqlReady()) {
    return res.status(503).json({
      error: "MySQL is not connected. Start MySQL so scraped name, category, images, and other fields can be stored.",
    });
  }

  let data;
  try {
    data = await extractDocument({
      html: req.body?.html || "",
      docxPath: doc.docxPath,
      filename: `${doc.title}.docx`,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message || "Scraping service failed." });
  }

  try {
    const stored = await saveExtraction(doc.id, data);
    const mysql = { ...mysqlLocation(), document_id: doc.id, extraction_id: stored.id };
    console.log(`Stored scraped fields in MySQL ${mysql.database}.${mysql.table} for ${doc.id}`);
    res.json({ extraction: stored, stored: true, mysql });
  } catch (err) {
    console.error("MySQL save failed:", err);
    res.status(503).json({ error: `Scraped fields could not be saved to MySQL: ${err.message}` });
  }
});

router.post("/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded." });
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
