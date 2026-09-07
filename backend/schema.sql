CREATE DATABASE IF NOT EXISTS docusync
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE docusync;

-- Connect as root with no password. No extra MySQL user is required.

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
);

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
);
