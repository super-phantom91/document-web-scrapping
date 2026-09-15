from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from extractor import scrap_document

app = FastAPI(title="DocuSync Extractor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "extractor"}


@app.post("/extract")
async def extract(
    file: UploadFile | None = File(default=None),
    html: str | None = Form(default=None),
    filename: str | None = Form(default=None),
):
    if not file and not html:
        raise HTTPException(status_code=400, detail="Provide a DOCX file and/or HTML content.")

    payload = None
    name = filename or "document"

    if file is not None:
        name = file.filename or filename or "document.docx"
        if not name.lower().endswith(".docx"):
            raise HTTPException(status_code=400, detail="Only .docx files are supported.")
        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        return scrap_document(html=html, docx_bytes=payload, filename=name)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not scrap document: {exc}") from exc
