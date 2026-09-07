import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getPool } from "./db.js";
import { UPLOADS_DIR } from "./store.js";

function jsonValue(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function imageBuffer(img) {
  if (img?.data) return Buffer.from(img.data, "base64");
  if (img?.src?.startsWith("/uploads/")) {
    const file = path.join(UPLOADS_DIR, path.basename(img.src));
    if (fs.existsSync(file)) return fs.readFileSync(file);
  }
  return null;
}

function rowToExtraction(row, images) {
  return {
    id: row.id,
    document_id: row.document_id,
    name: row.name,
    category: row.category,
    title: row.title,
    author: row.author,
    last_modified_by: row.last_modified_by,
    subject: row.subject,
    keywords: row.keywords,
    created: row.created_at_doc,
    modified: row.modified_at_doc,
    source: row.source,
    filename: row.filename,
    word_count: row.word_count,
    character_count: row.character_count,
    headings: parseJson(row.headings, []),
    paragraphs: parseJson(row.paragraphs, []),
    tables: parseJson(row.tables_json, []),
    key_values: parseJson(row.key_values, {}),
    emails: parseJson(row.emails, []),
    phones: parseJson(row.phones, []),
    dates: parseJson(row.dates, []),
    images,
    stored_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export async function getExtraction(documentId) {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM extractions WHERE document_id = ? LIMIT 1", [documentId]);
  if (!rows.length) return null;
  const [imageRows] = await pool.query(
    "SELECT * FROM extraction_images WHERE extraction_id = ? ORDER BY sort_order ASC",
    [rows[0].id]
  );
  const images = imageRows.map((img) => ({
    name: img.name,
    content_type: img.content_type,
    width: img.width,
    height: img.height,
    size_bytes: img.size_bytes,
    src: img.src,
    data: img.image_data ? Buffer.from(img.image_data).toString("base64") : null,
  }));
  return rowToExtraction(rows[0], images);
}

export async function saveExtraction(documentId, data) {
  const pool = getPool();
  const conn = await pool.getConnection();
  const extractionId = uuid();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM extractions WHERE document_id = ?", [documentId]);
    await conn.execute(
      `INSERT INTO extractions (
        id, document_id, name, category, title, author, last_modified_by, subject, keywords,
        created_at_doc, modified_at_doc, source, filename, word_count, character_count,
        headings, paragraphs, tables_json, key_values, emails, phones, dates
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        extractionId,
        documentId,
        data.name || null,
        data.category || null,
        data.title || null,
        data.author || null,
        data.last_modified_by || null,
        data.subject || null,
        data.keywords || null,
        data.created || null,
        data.modified || null,
        data.source || null,
        data.filename || null,
        data.word_count ?? null,
        data.character_count ?? null,
        jsonValue(data.headings || []),
        jsonValue(data.paragraphs || []),
        jsonValue(data.tables || []),
        jsonValue(data.key_values || {}),
        jsonValue(data.emails || []),
        jsonValue(data.phones || []),
        jsonValue(data.dates || []),
      ]
    );

    for (const [index, img] of (data.images || []).entries()) {
      await conn.execute(
        `INSERT INTO extraction_images (
          id, extraction_id, document_id, name, content_type, width, height, size_bytes, src, image_data, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          extractionId,
          documentId,
          img.name || null,
          img.content_type || null,
          img.width ?? null,
          img.height ?? null,
          img.size_bytes ?? null,
          img.src || null,
          imageBuffer(img),
          index,
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return getExtraction(documentId);
}

export async function deleteExtraction(documentId) {
  const pool = getPool();
  await pool.execute("DELETE FROM extractions WHERE document_id = ?", [documentId]);
}
