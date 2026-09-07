import mysql from "mysql2/promise.js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const config = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE || "docusync",
};

let pool = null;
let ready = false;

export function isMysqlReady() {
  return ready;
}

export function getPool() {
  if (!pool) throw new Error("MySQL is not connected.");
  return pool;
}

export async function pingMysql() {
  if (!pool) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function ensureColumns(pool, table, columns) {
  for (const [name, definition] of columns) {
    try {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") throw err;
    }
  }
}

export async function initDb() {
  const admin = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    insecureAuth: true,
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    insecureAuth: true,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS extractions (
      id CHAR(36) NOT NULL PRIMARY KEY,
      document_id VARCHAR(64) NOT NULL,
      name VARCHAR(512) NULL,
      category VARCHAR(512) NULL,
      title VARCHAR(512) NULL,
      summary TEXT NULL,
      description TEXT NULL,
      author VARCHAR(512) NULL,
      tags VARCHAR(512) NULL,
      extra_json JSON NULL,
      last_modified_by VARCHAR(512) NULL,
      subject VARCHAR(512) NULL,
      keywords TEXT NULL,
      created_at_doc VARCHAR(64) NULL,
      modified_at_doc VARCHAR(64) NULL,
      source VARCHAR(32) NULL,
      filename VARCHAR(512) NULL,
      word_count INT NULL,
      character_count INT NULL,
      headings JSON NULL,
      paragraphs JSON NULL,
      tables_json JSON NULL,
      key_values JSON NULL,
      emails JSON NULL,
      phones JSON NULL,
      dates JSON NULL,
      extracted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_document (document_id)
    )
  `);

  await ensureColumns(pool, "extractions", [
    ["summary", "TEXT NULL"],
    ["description", "TEXT NULL"],
    ["tags", "VARCHAR(512) NULL"],
    ["extra_json", "JSON NULL"],
  ]);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS extraction_images (
      id CHAR(36) NOT NULL PRIMARY KEY,
      extraction_id CHAR(36) NOT NULL,
      document_id VARCHAR(64) NOT NULL,
      name VARCHAR(512) NULL,
      content_type VARCHAR(128) NULL,
      width INT NULL,
      height INT NULL,
      size_bytes INT NULL,
      src TEXT NULL,
      image_data LONGBLOB NULL,
      sort_order INT NOT NULL DEFAULT 0,
      CONSTRAINT fk_extraction_images
        FOREIGN KEY (extraction_id) REFERENCES extractions(id) ON DELETE CASCADE
    )
  `);

  ready = true;
  const auth = config.password ? "with password" : "no password";
  console.log(`MySQL connected ${config.host}:${config.port}/${config.database} as ${config.user} (${auth})`);
}
