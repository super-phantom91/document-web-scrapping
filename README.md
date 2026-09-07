# DocuSync

A multi-person, Word-style document editor (React) with live collaboration (Node.js) and one-click extraction of name, category, images, tables, and other fields from DOCX files (Python).

## What you get

- Google Docs-style shared editing: live text, colored cursors, and presence avatars
- MS Word-style controls: fonts, sizes, bold/italic/underline, color, highlight, alignment, headings, lists, tables, images, links
- Import `.docx` into the editor
- **Extract** button: Python reads the Word file (and current page HTML) and returns name, category, author, images, tables, emails, dates, and key-value fields
- Those fields are **saved in MySQL** (`extractions` + `extraction_images` with image BLOBs)
- Anyone signed in can open a shared document link and edit together

## Architecture

```
React (Vite :5173)
  → Node.js Express API (:4000)   documents, auth, image upload, DOCX import
  → Hocuspocus / Yjs (:1234)      realtime CRDT sync
  → FastAPI Python (:8000)        DOCX + HTML extraction
  → MySQL (:3306)                 stored name, category, images, tables, fields
```

## Requirements

- Node.js 18+
- Python 3.10+
- MySQL 8 (or MariaDB)

## MySQL

Extracted **name**, **category**, **images**, and the other fields are stored in MySQL. The API connects as `root` with an **empty password** — you do not create a MySQL user or set `MYSQL_USER` / `MYSQL_PASSWORD`.

Start MySQL before using **Extract**. Copy `backend/.env.example` to `backend/.env` only if you need a different host or port.

**Docker** (from the project root):

```bash
docker compose up -d mysql
```

**Existing MySQL** (XAMPP, WAMP, local server with root and no password):

```sql
CREATE DATABASE IF NOT EXISTS docusync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Tables are created automatically when the Node API starts. Schema is also in `backend/schema.sql`.

- `extractions` — name, category, title, author, headings, tables, emails, dates, key-value fields
- `extraction_images` — image binary (`LONGBLOB`) plus content type and filename

Press **Extract** to write a row (one saved extraction per document). **Saved** reopens the MySQL record without running extraction again.

## Run locally

From the project root:

```bash
npm install
npm run install:all
python -m pip install -r python-service/requirements.txt
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

Create an account, start a blank document or import a `.docx`, invite a teammate with **Share**, and press **Extract** to pull structured information.

If `npm run dev` cannot start Python on Windows, run the three processes yourself:

```bash
python -m uvicorn main:app --reload --port 8000 --app-dir python-service
npm run dev:backend
npm run dev:frontend
```

## Extracted fields

The Python service looks at Word core properties and document text for:

- Name / title
- Category / subject
- Author, dates, keywords
- Headings (outline)
- Embedded images
- Tables
- `Label: value` pairs such as `Name: …` and `Category: …`
- Emails, phone numbers, and dates
