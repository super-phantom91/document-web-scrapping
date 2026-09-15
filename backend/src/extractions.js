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
    summary: row.summary,
    description: row.description,
    author: row.author,
    tags: row.tags,
    extra: parseJson(row.extra_json, {}),
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

function scrapSnapshot(data) {
  return {
    name: data.name || null,
    category: data.category || null,
    title: data.title || null,
    summary: data.summary || null,
    description: data.description || null,
    author: data.author || null,
    tags: data.tags || null,
    extra: data.extra || {},
    emails: data.emails || [],
    phones: data.phones || [],
    dates: data.dates || [],
    headings: data.headings || [],
    tables: data.tables || [],
    key_values: data.key_values || {},
    source: data.source || null,
    filename: data.filename || null,
    images: (data.images || []).map((img) => ({
      name: img.name || null,
      content_type: img.content_type || null,
      size_bytes: img.size_bytes ?? null,
      src: img.src || null,
    })),
  };
}

export async function saveExtraction(documentId, data) {
  const pool = getPool();
  const conn = await pool.getConnection();
  const extractionId = uuid();
  const snapshot = scrapSnapshot(data);
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM extractions WHERE document_id = ?", [documentId]);
    await conn.execute(
      `INSERT INTO extractions (
        id, document_id, name, category, title, summary, description, author, tags, extra_json,
        last_modified_by, subject, keywords,
        created_at_doc, modified_at_doc, source, filename, word_count, character_count,
        headings, paragraphs, tables_json, key_values, emails, phones, dates, scraped_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        extractionId,
        documentId,
        snapshot.name,
        snapshot.category,
        snapshot.title,
        snapshot.summary,
        snapshot.description,
        snapshot.author,
        snapshot.tags,
        jsonValue(snapshot.extra),
        data.last_modified_by || null,
        data.subject || null,
        data.keywords || null,
        data.created || null,
        data.modified || null,
        snapshot.source,
        snapshot.filename,
        data.word_count ?? null,
        data.character_count ?? null,
        jsonValue(snapshot.headings),
        jsonValue(data.paragraphs || []),
        jsonValue(snapshot.tables),
        jsonValue(snapshot.key_values),
        jsonValue(snapshot.emails),
        jsonValue(snapshot.phones),
        jsonValue(snapshot.dates),
        jsonValue(snapshot),
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
  const stored = await getExtraction(documentId);
  if (!stored) {
    throw new Error("MySQL did not keep the scraped row.");
  }
  return stored;
}

export async function deleteExtraction(documentId) {
  const pool = getPool();
  await pool.execute("DELETE FROM extractions WHERE document_id = ?", [documentId]);
}
