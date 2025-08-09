
import React from "react";
import ReactDOM from "react-dom/client";
import * as ReactQuery from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";

// Read API base that we set in config.js
const API_BASE = window.API_BASE || (location.origin.includes(":") ? "http://localhost:8000" : "");

const { useState, useMemo } = React;
const { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } = ReactQuery;

function useFetch(url, opts) {
  return useQuery({
    queryKey: [url, opts],
    queryFn: async () => {
      const res = await axios.get(API_BASE + url);
      return res.data;
    },
  });
}

function App() {
  const qc = useQueryClient();
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [search, setSearch] = useState("");

  const { data: jurisdictions = [], isLoading: jLoading } = useFetch("/api/jurisdictions");
  const meetingsUrl = useMemo(
    () => selectedJurisdiction ? `/api/meetings?jurisdiction=${encodeURIComponent(selectedJurisdiction)}` : "/api/meetings",
    [selectedJurisdiction]
  );
  const { data: meetings = [], isLoading: mLoading } = useFetch(meetingsUrl);

  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter(m => !q || m.title.toLowerCase().includes(q));
  }, [meetings, search]);

  const summariesUrl = useMemo(
    () => selectedMeeting ? `/api/summaries?meeting_id=${encodeURIComponent(selectedMeeting.id)}` : "/api/summaries",
    [selectedMeeting]
  );
  const { data: summaries = [], isLoading: sLoading } = useFetch(summariesUrl);

  const summarize = useMutation({
    mutationFn: async (meeting_id) => {
      const res = await axios.post(API_BASE + "/api/summarize", { meeting_id, force: true });
      return res.data;
    },
    onSuccess: () => { qc.invalidateQueries(); }
  });

  return (
    <div style={{height:"100vh", display:"flex", flexDirection:"column"}}>
      <TopBar onSearch={setSearch} />
      <div className="app-grid" style={{display:"grid", gridTemplateColumns:"1fr 1.3fr 1.6fr", gap:16, padding:16, flex:1}}>
        <Sidebar jurisdictions={jurisdictions} selected={selectedJurisdiction} onSelect={setSelectedJurisdiction} loading={jLoading} />
        <MeetingsPane meetings={filteredMeetings} selected={selectedMeeting} onSelect={setSelectedMeeting} loading={mLoading} />
        <SummariesPane summaries={summaries} meeting={selectedMeeting} loading={sLoading} onSummarize={() => selectedMeeting && summarize.mutate(selectedMeeting.id)} />
      </div>
      <Footer />
    </div>
  );
}

function TopBar({ onSearch }) {
  return (
    <div style={{borderBottom:"1px solid #e5e7eb", background:"rgba(255,255,255,.85)", backdropFilter:"blur(6px)"}}>
      <div style={{maxWidth:1120, margin:"0 auto", display:"flex", alignItems:"center", gap:12, padding:12}}>
        <div style={{fontWeight:800, fontSize:20}}>🪰 Gadfly</div>
        <div style={{color:"#64748b", fontSize:12}}>Jurisdictions • Meetings • Summaries</div>
        <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:8}}>
          <input placeholder="Search meetings…" onChange={e=>onSearch(e.target.value)} className="input" style={{border:"1px solid #e5e7eb", borderRadius:10, padding:"8px 10px", width:280}} />
          <a href="#" onClick={(e)=>{e.preventDefault(); location.reload();}} style={{fontSize:13, color:"#2563eb"}}>Refresh</a>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ jurisdictions, selected, onSelect, loading }) {
  return (
    <div className="card" style={{background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:12, display:"flex", flexDirection:"column", overflow:"hidden"}}>
      <div className="row" style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
        <div style={{fontWeight:600}}>Jurisdictions</div>
        <span className="muted" style={{color:"#64748b", fontSize:12}}>{loading ? "…" : jurisdictions.length}</span>
      </div>
      <div className="scroll" style={{overflow:"auto", borderTop:"1px solid #f1f5f9"}}>
        {jurisdictions.map(j => (
          <button key={j.id} onClick={()=>onSelect(j.name || j.id)} style={{width:"100%", textAlign:"left", padding:"10px 12px", border:"none", background:selected===(j.name||j.id) ? "#f1f5f9" : "transparent", cursor:"pointer"}}>
            <div className="row" style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <span>{j.name || j.id}</span>
              <span className="muted" style={{color:"#64748b", fontSize:12}}>{j.meetings ?? 0}</span>
            </div>
            {j.url && <div className="muted" style={{color:"#64748b", fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{j.url}</div>}
          </button>
        ))}
        {!jurisdictions.length && !loading && <div className="muted" style={{padding:12}}>No jurisdictions yet.</div>}
      </div>
      <div style={{marginTop:"auto", paddingTop:8}}>
        <UploadWidget />
      </div>
    </div>
  );
}

function MeetingsPane({ meetings, selected, onSelect, loading }) {
  return (
    <div className="card">
      <div className="row" style={{marginBottom:8}}>
        <div style={{fontWeight:600}}>Meetings</div>
        <span className="muted">{loading ? "…" : meetings.length}</span>
      </div>
      <div className="scroll" style={{overflow:"auto", borderTop:"1px solid #f1f5f9"}}>
        {meetings.map(m => (
          <button key={m.id} onClick={()=>onSelect(m)} style={{width:"100%", textAlign:"left", padding:"10px 12px", border:"none", background:selected?.id===m.id ? "#f1f5f9" : "transparent", cursor:"pointer"}}>
            <div className="row">
              <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{m.title}</span>
              <span className="muted">{m.jurisdiction}</span>
            </div>
            {m.date && <div className="muted">{m.date}</div>}
          </button>
        ))}
        {!meetings.length && !loading && <div className="muted" style={{padding:12}}>No meetings found.</div>}
      </div>
    </div>
  );
}

function SummariesPane({ summaries, meeting, loading, onSummarize }) {
  return (
    <div className="card">
      <div className="row" style={{marginBottom:8}}>
        <div style={{fontWeight:600}}>Summaries</div>
        <div className="row" style={{gap:8}}>
          <button onClick={onSummarize} disabled={!meeting} className="btn">Summarize</button>
          <span className="muted">{loading ? "…" : summaries.length}</span>
        </div>
      </div>
      <div className="scroll" style={{overflow:"auto", borderTop:"1px solid #f1f5f9"}}>
        {meeting && <div className="muted" style={{padding:"8px 12px"}}>Meeting: {meeting.title}</div>}
        {summaries.map(s => (
          <article key={s.id} style={{border:"1px solid #e5e7eb", borderRadius:12, padding:12, margin:12, background:"#fff"}}>
            <div className="muted" style={{marginBottom:6}}>{s.id}</div>
            <p style={{whiteSpace:"pre-wrap", lineHeight:1.5, margin:0}}>{s.preview}</p>
          </article>
        ))}
        {!summaries.length && !loading && <div className="muted" style={{padding:12}}>No summaries yet. Select a meeting and click <em>Summarize</em>.</div>}
      </div>
    </div>
  );
}

function UploadWidget() {
  const [file, setFile] = React.useState(null);
  const [jurisdiction, setJurisdiction] = React.useState("");
  const [status, setStatus] = React.useState("");
  const onUpload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("jurisdiction", jurisdiction || "Uploads");
    setStatus("Uploading…");
    try {
      await axios.post(API_BASE + "/api/upload", form);
      setStatus("Uploaded!");
    } catch (e) {
      setStatus("Error uploading");
    }
  };
  return (
    <div className="card" style={{padding:12}}>
      <div style={{fontWeight:600, marginBottom:6}}>Upload PDFs</div>
      <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0] || null)} />
      <input className="input" style={{marginTop:8}} placeholder="Jurisdiction (optional)" value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)} />
      <div className="row" style={{marginTop:8}}>
        <button className="btn" onClick={onUpload}>Upload</button>
        <span className="muted">{status}</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{textAlign:"center", fontSize:12, color:"#64748b", padding:"8px 0"}}>Made with ❤️ for Orting & friends</div>
  );
}

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={qc}>
    <App />
  </QueryClientProvider>
);
