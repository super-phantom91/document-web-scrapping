import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
export const UPLOADS_DIR = path.join(ROOT, "uploads");
export const YJS_DIR = path.join(DATA_DIR, "yjs");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, YJS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ users: [], documents: [] }, null, 2));
  }
}

ensureDirs();

function readStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
}

function writeStore(data) {
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

export function findUserByUsername(username) {
  return readStore().users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

export function findUserById(id) {
  return readStore().users.find((u) => u.id === id) || null;
}

export function createUser(user) {
  const store = readStore();
  store.users.push(user);
  writeStore(store);
  return user;
}

export function listDocumentsForUser(userId) {
  return readStore()
    .documents.filter((d) => isDocumentMember(d, userId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((d) => publicDocument(d, userId));
}

export function isDocumentMember(doc, userId) {
  return doc.ownerId === userId || (doc.memberIds || []).includes(userId);
}

export function canAccessDocument(doc, userId) {
  if (!doc) return false;
  if (isDocumentMember(doc, userId)) return true;
  return doc.visibility === "link";
}

export function addDocumentMember(id, userId) {
  const store = readStore();
  const doc = store.documents.find((d) => d.id === id);
  if (!doc) return null;
  doc.memberIds = Array.isArray(doc.memberIds) ? doc.memberIds : [];
  if (userId && doc.ownerId !== userId && !doc.memberIds.includes(userId)) {
    doc.memberIds.push(userId);
    writeStore(store);
  }
  return doc;
}

export function removeDocumentMember(id, userId) {
  const store = readStore();
  const doc = store.documents.find((d) => d.id === id);
  if (!doc) return null;
  doc.memberIds = (doc.memberIds || []).filter((memberId) => memberId !== userId);
  writeStore(store);
  return doc;
}

export function publicDocument(doc, viewerId) {
  if (!doc) return null;
  const store = readStore();
  const owner = store.users.find((u) => u.id === doc.ownerId);
  const people = [
    owner ? { ...publicUser(owner), role: "Owner" } : null,
    ...(doc.memberIds || [])
      .map((memberId) => store.users.find((u) => u.id === memberId))
      .filter(Boolean)
      .map((u) => ({ ...publicUser(u), role: "Can edit" })),
  ].filter(Boolean);
  return {
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    ownerName: doc.ownerName,
    visibility: doc.visibility || "link",
    initialHtml: doc.initialHtml || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    shared: Boolean(viewerId && doc.ownerId !== viewerId),
    people,
  };
}

export function getDocument(id) {
  return readStore().documents.find((d) => d.id === id) || null;
}

export function createDocument(doc) {
  const store = readStore();
  store.documents.push({ memberIds: [], visibility: "link", ...doc });
  writeStore(store);
  return store.documents[store.documents.length - 1];
}

export function updateDocument(id, patch) {
  const store = readStore();
  const index = store.documents.findIndex((d) => d.id === id);
  if (index === -1) return null;
  store.documents[index] = { ...store.documents[index], ...patch, updatedAt: new Date().toISOString() };
  writeStore(store);
  return store.documents[index];
}

export function deleteDocument(id) {
  const store = readStore();
  const doc = store.documents.find((d) => d.id === id);
  store.documents = store.documents.filter((d) => d.id !== id);
  writeStore(store);

  const yjsFile = path.join(YJS_DIR, `${id}.bin`);
  if (fs.existsSync(yjsFile)) fs.unlinkSync(yjsFile);
  if (doc?.docxPath && fs.existsSync(doc.docxPath)) fs.unlinkSync(doc.docxPath);
  return doc || null;
}

export function publicUser(user) {
  if (!user) return null;
  return { id: user.id, username: user.username, color: user.color, createdAt: user.createdAt };
}
