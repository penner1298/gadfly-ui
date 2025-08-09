from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from pathlib import Path
import os, json, subprocess, shutil, datetime

# ---------- Config & paths ----------
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data")).resolve()
DOWNLOADS_DIR = DATA_DIR / "downloads"
SUMMARIES_DIR = DATA_DIR / "summaries"

# Ensure folders exist
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "uploads").mkdir(parents=True, exist_ok=True)

# ---------- App ----------
app = FastAPI(title="Gadfly API")

# CORS so the UI can call the API from a different origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gadfly-ui.onrender.com"],  # or ["*"] while testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Helpers ----------
def iter_pdfs() -> list[Path]:
    """Recursively find all .pdf files under /downloads (case-insensitive)."""
    if not DOWNLOADS_DIR.exists():
        return []
    return [p for p in DOWNLOADS_DIR.rglob("*") if p.is_file() and p.suffix.lower() == ".pdf"]

# ---------- Debug / health ----------
@app.get("/api/health")
def health():
    return {"ok": True, "timestamp": datetime.datetime.utcnow().isoformat()}

@app.get("/api/debug/fs")
def debug_fs():
    def ls(p: Path):
        if not p.exists():
            return {"exists": False, "path": str(p)}
        out = []
        for root, dirs, files in os.walk(p):
            out.append({"dir": root, "files": files[:10], "files_count": len(files)})
        return out[:50]
    return {
        "DATA_DIR": str(DATA_DIR),
        "downloads_exists": DOWNLOADS_DIR.exists(),
        "summaries_exists": SUMMARIES_DIR.exists(),
        "downloads_tree": ls(DOWNLOADS_DIR),
        "summaries_tree": ls(SUMMARIES_DIR),
    }

# ---------- API: Jurisdictions / Meetings / Summaries ----------
@app.get("/api/jurisdictions")
def list_jurisdictions():
    items, seen = [], set()
    for p in iter_pdfs():
        rel = p.relative_to(DOWNLOADS_DIR)
        parts = rel.parts
        jur = parts[0] if len(parts) > 1 else "Root"
        if jur not in seen:
            seen.add(jur)
            items.append({"id": jur, "name": jur})
    return items

@app.get("/api/meetings")
def list_meetings(jurisdiction: Optional[str] = None):
    out = []
    for p in iter_pdfs():
        rel = p.relative_to(DOWNLOADS_DIR)
        parts = rel.parts
        jur = parts[0] if len(parts) > 1 else "Root"
        if jurisdiction and jurisdiction != jur:
            continue
        out.append({
            "id": rel.as_posix(),   # e.g. "Uploads/Council Agenda Packet 7102024.pdf"
            "title": p.stem,        # filename without .pdf
            "jurisdiction": jur,
            "date": None,           # optional: parse from filename if you want
        })
    out.sort(key=lambda m: m["title"], reverse=True)
    return out

@app.get("/api/summaries")
def list_summaries(meeting_id: Optional[str] = None):
    items: list[Dict[str, Any]] = []
    if not SUMMARIES_DIR.exists():
        return items
    # If you mirror PDF structure under /summaries, you can match on prefix of meeting_id
    for root, _, files in os.walk(SUMMARIES_DIR):
        for f in files:
            if f.lower().endswith((".json", ".txt")):
                path = Path(root) / f
                rel = path.relative_to(SUMMARIES_DIR).as_posix()
                if meeting_id and not rel.startswith(meeting_id):
                    continue
                try:
                    if path.suffix.lower() == ".json":
                        obj = json.loads(path.read_text())
                        preview = obj.get("summary") or obj.get("content") or json.dumps(obj)
                    else:
                        preview = path.read_text(errors="ignore")
                except Exception as e:
                    preview = f"Error reading: {e}"
                items.append({
                    "id": rel,
                    "preview": preview[:1000],
                })
    return items

# ---------- Actions ----------
class SummarizeRequest(BaseModel):
    meeting_id: Optional[str] = None
    force: bool = False

@app.post("/api/summarize")
def summarize(req: SummarizeRequest):
    # TODO: wire to your pipeline; for now just echo
    return {"status": "queued", "meeting_id": req.meeting_id, "force": req.force}

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), jurisdiction: str = Form("Uploads")):
    jdir = DOWNLOADS_DIR / jurisdiction.replace(" ", "_")
    jdir.mkdir(parents=True, exist_ok=True)
    dest = jdir / file.filename
    with open(dest, "wb") as f:
        f.write(await file.read())
    return {"ok": True, "saved_to": dest.as_posix()}

# ---------- Static mounts (optional for debugging) ----------
app.mount("/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")
app.mount("/summaries", StaticFiles(directory=str(SUMMARIES_DIR)), name="summaries")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
