
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os, json, pathlib, subprocess, shutil, datetime

DATA_DIR = pathlib.Path(os.environ.get("DATA_DIR", "./data")).resolve()
DOWNLOADS_DIR = DATA_DIR / "downloads"
SUMMARIES_DIR = DATA_DIR / "summaries"
USERS_FILE = pathlib.Path("./users.json")
JURISDICTIONS_FILE = pathlib.Path("./jurisdictions.json")

app = FastAPI(title="Gadfly API")

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
    try:
        with open(JURISDICTIONS_FILE, "r") as f:
            all_j = json.load(f)
    except FileNotFoundError:
        all_j = []
    # annotate with counts
    for j in all_j:
        j_id = j.get("id") or j.get("name")
        j["id"] = j_id
        # Count meetings by folders under downloads/<name>
        ddir = DOWNLOADS_DIR / j.get("name", j_id).replace(" ", "_")
        j["meetings"] = len([p for p in ddir.glob("**/*.pdf")])
    return all_j

@app.get("/api/meetings")
def list_meetings(jurisdiction: Optional[str] = None):
    meetings = []
    roots = []
    if jurisdiction:
        roots = [(jurisdiction, DOWNLOADS_DIR / jurisdiction.replace(" ", "_"))]
    else:
        # all top level dirs
        roots = [(p.name, p) for p in DOWNLOADS_DIR.glob("*") if p.is_dir()]
    for jname, root in roots:
        for pdf in root.glob("**/*.pdf"):
            rel = pdf.relative_to(DOWNLOADS_DIR).as_posix()
            meetings.append({
                "id": rel,
                "jurisdiction": jname,
                "title": pdf.stem,
                "path": rel,
                "date": None
            })
    meetings.sort(key=lambda m: m["path"])
    return meetings

@app.get("/api/summaries")
def list_summaries(meeting_id: Optional[str] = None):
    items = []
    if meeting_id:
        # match summaries for this meeting path (convention: same rel path under summaries with .json or .txt)
        p_json = (SUMMARIES_DIR / meeting_id).with_suffix(".json")
        p_txt = (SUMMARIES_DIR / meeting_id).with_suffix(".txt")
        for p in [p_json, p_txt]:
            if p.exists():
                items.append(_summary_from_file(p))
    else:
        for p in SUMMARIES_DIR.glob("**/*"):
            if p.suffix.lower() in [".json", ".txt"] and p.is_file():
                items.append(_summary_from_file(p))
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
