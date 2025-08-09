
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os, json, pathlib, subprocess, shutil, datetime


from pathlib import Path
import os

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DOWNLOADS = DATA_DIR / "downloads"
SUMMARIES = DATA_DIR / "summaries"

def iter_pdfs():
    # recursively find .pdf (case-insensitive)
    if not DOWNLOADS.exists():
        return []
    return [p for p in DOWNLOADS.rglob("*") if p.is_file() and p.suffix.lower() == ".pdf"]




DATA_DIR = pathlib.Path(os.environ.get("DATA_DIR", "./data")).resolve()
DOWNLOADS_DIR = DATA_DIR / "downloads"
SUMMARIES_DIR = DATA_DIR / "summaries"
USERS_FILE = pathlib.Path("./users.json")
JURISDICTIONS_FILE = pathlib.Path("./jurisdictions.json")

app = FastAPI(title="Gadfly API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gadfly-ui.onrender.com"],  # or ["*"] while testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import os, json
from pathlib import Path

@app.get("/api/debug/fs")
def debug_fs():
    base = Path(os.environ.get("DATA_DIR", "/data"))
    downloads = (base / "downloads")
    summaries = (base / "summaries")
    def ls(p):
        if not p.exists():
            return {"exists": False, "path": str(p)}
        out = []
        for root, dirs, files in os.walk(p):
            out.append({"dir": root, "files": files[:10], "files_count": len(files)})
        return out[:50]
    return {
        "DATA_DIR": str(base),
        "downloads_exists": downloads.exists(),
        "summaries_exists": summaries.exists(),
        "downloads_tree": ls(downloads),
        "summaries_tree": ls(summaries),
    }




app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure folders
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
SUMMARIES_DIR.mkdir(parents=True, exist_ok=True)
(DATA_DIR / "uploads").mkdir(parents=True, exist_ok=True)

@app.get("/api/health")
def health():
    return {"ok": True, "timestamp": datetime.datetime.utcnow().isoformat()}

@app.get("/api/jurisdictions")
def list_jurisdictions():
    items = []
    seen = set()
    for p in iter_pdfs():
        try:
            rel = p.relative_to(DOWNLOADS)
        except ValueError:
            rel = p.name
        parts = rel.parts
        jur = parts[0] if len(parts) > 1 else "Root"
        if jur not in seen:
            seen.add(jur)
            items.append({"id": jur, "name": jur})
    return items




@app.get("/api/meetings")
def list_meetings(jurisdiction: str | None = None):
    out = []
    for p in iter_pdfs():
        rel = p.relative_to(DOWNLOADS)
        parts = rel.parts
        jur = parts[0] if len(parts) > 1 else "Root"
        if jurisdiction and jurisdiction != jur:
            continue
        out.append({
            "id": rel.as_posix(),
            "title": p.stem,
            "jurisdiction": jur,
            "date": None,
        })
    out.sort(key=lambda m: m["title"], reverse=True)
    return out




@app.get("/api/summaries")
def list_summaries(meeting_id: str | None = None):
    items = []
    if not SUMMARIES.exists():
        return items
    for root, _, files in os.walk(SUMMARIES):
        for f in files:
            if f.lower().endswith((".json", ".txt")):
                path = Path(root) / f
                rel = path.relative_to(SUMMARIES).as_posix()
                if meeting_id and not rel.startswith(meeting_id):
                    continue
                items.append({
                    "id": rel,
                    "preview": path.read_text(errors="ignore")[:1000]
                })
    return items




def _summary_from_file(path: pathlib.Path) -> Dict[str, Any]:
    try:
        if path.suffix.lower() == ".json":
            obj = json.loads(path.read_text())
            text = obj.get("summary") or obj.get("content") or json.dumps(obj)[:2000]
        else:
            text = path.read_text()
    except Exception as e:
        text = f"Error reading: {e}"
    return {
        "id": path.relative_to(SUMMARIES_DIR).as_posix(),
        "meeting_id": path.with_suffix(".pdf").relative_to(SUMMARIES_DIR).as_posix(),
        "preview": text[:2000],
        "bytes": path.stat().st_size,
        "updated_at": path.stat().st_mtime,
    }

class SummarizeRequest(BaseModel):
    meeting_id: Optional[str] = None
    force: bool = False

@app.post("/api/summarize")
def summarize(req: SummarizeRequest):
    # Wire up your existing pipeline here as a subprocess call or import
    # For now this is a stub that just echoes back the request.
    return {"status": "queued", "meeting_id": req.meeting_id, "force": req.force}

@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), jurisdiction: str = Form("Uploads")):
    jdir = DOWNLOADS_DIR / jurisdiction.replace(" ", "_")
    jdir.mkdir(parents=True, exist_ok=True)
    dest = jdir / file.filename
    with open(dest, "wb") as f:
        f.write(await file.read())
    return {"ok": True, "saved_to": dest.as_posix()}

# Mount a simple file server for downloads and summaries for debugging
app.mount("/downloads", StaticFiles(directory=str(DOWNLOADS_DIR)), name="downloads")
app.mount("/summaries", StaticFiles(directory=str(SUMMARIES_DIR)), name="summaries")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
