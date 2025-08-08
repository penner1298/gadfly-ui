
# Gadfly UI Starter

A lightweight UI + API wrapper to visualize your existing Gadfly pipeline.

## Run the API
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
API defaults to http://localhost:8000 and serves
- `GET /api/jurisdictions`
- `GET /api/meetings?jurisdiction=Orting`
- `GET /api/summaries?meeting_id=<path>`
- `POST /api/summarize` (stub; wire to your pipeline)
- `POST /api/upload` (PDF upload)

## Run the UI
Open `frontend/index.html` in your browser. It calls the API above.
To change the API base, define `window.API_BASE` before loading `app.jsx` or serve both on the same host.

## Wiring to your pipeline
Replace the `/api/summarize` stub in `backend/app.py` to call your existing scripts:
- import functions from `gadfly_pipeline.py` or `gadfly_pdf_summarizer.py`
- or `subprocess.run([...])` targeting a CLI you trust

Set DATA_DIR to where your downloads and summaries live:
```bash
export DATA_DIR=/path/to/data
```

## Deploy
- **Render/Heroku/Fly:** run the FastAPI app; serve `frontend/` as static or on a CDN.
- **Docker:** build a small image with uvicorn and mount a volume at `/data`.
