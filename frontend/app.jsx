
const { useState, useMemo, useEffect } = React;
const { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } = ReactQuery;

const API_BASE = window.API_BASE || (location.origin.includes(":") ? "http://localhost:8000" : "");

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
  const meetingsUrl = useMemo(() => selectedJurisdiction ? `/api/meetings?jurisdiction=${encodeURIComponent(selectedJurisdiction)}` : "/api/meetings", [selectedJurisdiction]);
  const { data: meetings = [], isLoading: mLoading } = useFetch(meetingsUrl);
  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter(m => !q || m.title.toLowerCase().includes(q));
  }, [meetings, search]);

  const summariesUrl = useMemo(() => selectedMeeting ? `/api/summaries?meeting_id=${encodeURIComponent(selectedMeeting.id)}` : "/api/summaries", [selectedMeeting]);
  const { data: summaries = [], isLoading: sLoading } = useFetch(summariesUrl);

  const summarize = useMutation({
    mutationFn: async (meeting_id) => {
      const res = await axios.post(API_BASE + "/api/summarize", { meeting_id, force: true });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    }
  });

  return (
    <div className="h-screen flex flex-col">
      <TopBar onSearch={setSearch} />
      <div className="flex-1 grid grid-cols-12 gap-4 p-4">
        <Sidebar
          jurisdictions={jurisdictions}
          selected={selectedJurisdiction}
          onSelect={setSelectedJurisdiction}
          loading={jLoading}
        />
        <MeetingsPane
          meetings={filteredMeetings}
          selected={selectedMeeting}
          onSelect={setSelectedMeeting}
          loading={mLoading}
        />
        <SummariesPane
          summaries={summaries}
          meeting={selectedMeeting}
          loading={sLoading}
          onSummarize={() => selectedMeeting && summarize.mutate(selectedMeeting.id)}
        />
      </div>
      <Footer />
    </div>
  );
}

function TopBar({ onSearch }) {
  return (
    <div className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 h-14">
        <div className="font-bold tracking-tight text-xl">🪰 Gadfly</div>
        <div className="text-sm text-gray-500">Jurisdictions • Meetings • Summaries</div>
        <div className="ml-auto flex items-center gap-2">
          <input placeholder="Search meetings…" onChange={e=>onSearch(e.target.value)} className="rounded-xl border px-3 py-1.5 w-72" />
          <a href="#" className="text-sm underline text-blue-600" onClick={(e)=>{e.preventDefault(); location.reload();}}>Refresh</a>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ jurisdictions, selected, onSelect, loading }) {
  return (
    <div className="col-span-3 bg-white rounded-2xl shadow-sm border p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Jurisdictions</h2>
        <span className="text-xs text-gray-500">{loading ? "…" : jurisdictions.length}</span>
      </div>
      <div className="overflow-auto divide-y">
        {jurisdictions.map(j => (
          <button key={j.id} onClick={()=>onSelect(j.name || j.id)} className={"w-full text-left px-3 py-2 hover:bg-gray-50 " + (selected===(j.name||j.id) ? "bg-gray-100 font-medium" : "")}>
            <div className="flex items-center justify-between">
              <span>{j.name || j.id}</span>
              <span className="text-xs text-gray-500">{j.meetings ?? 0}</span>
            </div>
            {j.url && <div className="text-xs text-gray-500 truncate">{j.url}</div>}
          </button>
        ))}
        {!jurisdictions.length && !loading && <div className="text-sm text-gray-500 p-3">No jurisdictions yet.</div>}
      </div>
      <div className="mt-auto pt-2">
        <UploadWidget />
      </div>
    </div>
  );
}

function MeetingsPane({ meetings, selected, onSelect, loading }) {
  return (
    <div className="col-span-4 bg-white rounded-2xl shadow-sm border p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Meetings</h2>
        <span className="text-xs text-gray-500">{loading ? "…" : meetings.length}</span>
      </div>
      <div className="overflow-auto divide-y">
        {meetings.map(m => (
          <button key={m.id} onClick={()=>onSelect(m)} className={"w-full text-left px-3 py-2 hover:bg-gray-50 " + (selected?.id===m.id ? "bg-gray-100 font-medium" : "")}>
            <div className="flex items-center justify-between">
              <span className="truncate">{m.title}</span>
              <span className="text-xs text-gray-500">{m.jurisdiction}</span>
            </div>
            {m.date && <div className="text-xs text-gray-500">{m.date}</div>}
          </button>
        ))}
        {!meetings.length && !loading && <div className="text-sm text-gray-500 p-3">No meetings found.</div>}
      </div>
    </div>
  );
}

function SummariesPane({ summaries, meeting, loading, onSummarize }) {
  return (
    <div className="col-span-5 bg-white rounded-2xl shadow-sm border p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Summaries</h2>
        <div className="flex items-center gap-2">
          <button onClick={onSummarize} disabled={!meeting} className={"px-3 py-1.5 rounded-xl border " + (!meeting ? "opacity-50" : "hover:bg-gray-50")}>Summarize</button>
          <span className="text-xs text-gray-500">{loading ? "…" : summaries.length}</span>
        </div>
      </div>
      <div className="overflow-auto space-y-3">
        {meeting && <div className="text-xs text-gray-500">Meeting: {meeting.title}</div>}
        {summaries.map(s => (
          <article key={s.id} className="border rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">{s.id}</div>
            <p className="whitespace-pre-wrap">{s.preview}</p>
          </article>
        ))}
        {!summaries.length && !loading && <div className="text-sm text-gray-500 p-3">No summaries yet. Select a meeting and click Summarize.</div>}
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
    <div className="border rounded-2xl p-3">
      <div className="font-medium mb-1">Upload PDFs</div>
      <input className="w-full text-sm" type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} />
      <input className="w-full text-sm border rounded-xl px-2 py-1 mt-2" placeholder="Jurisdiction (optional)" value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)} />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={onUpload} className="px-3 py-1.5 rounded-xl border hover:bg-gray-50">Upload</button>
        <span className="text-xs text-gray-500">{status}</span>
      </div>
    </div>
  );
}

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={qc}>
    <App />
  </QueryClientProvider>
);
