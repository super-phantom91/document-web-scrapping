import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
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
    .documents.filter((d) => d.ownerId === userId || d.visibility === "link")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function getDocument(id) {
  return readStore().documents.find((d) => d.id === id) || null;
}

export function createDocument(doc) {
  const store = readStore();
  store.documents.push(doc);
  writeStore(store);
  return doc;
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
