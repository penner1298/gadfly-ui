(() => {
  const { useState, useMemo, useEffect } = React;
  const { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } = ReactQuery;
  const API_BASE = window.API_BASE || (location.origin.includes(":") ? "http://localhost:8000" : "");
  function useFetch(url, opts) {
    return useQuery({
      queryKey: [url, opts],
      queryFn: async () => {
        const res = await axios.get(API_BASE + url);
        return res.data;
      }
    });
  }
  function App() {
    const qc2 = useQueryClient();
    const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [search, setSearch] = useState("");
    const { data: jurisdictions = [], isLoading: jLoading } = useFetch("/api/jurisdictions");
    const meetingsUrl = useMemo(() => selectedJurisdiction ? `/api/meetings?jurisdiction=${encodeURIComponent(selectedJurisdiction)}` : "/api/meetings", [selectedJurisdiction]);
    const { data: meetings = [], isLoading: mLoading } = useFetch(meetingsUrl);
    const filteredMeetings = useMemo(() => {
      const q = search.trim().toLowerCase();
      return meetings.filter((m) => !q || m.title.toLowerCase().includes(q));
    }, [meetings, search]);
    const summariesUrl = useMemo(() => selectedMeeting ? `/api/summaries?meeting_id=${encodeURIComponent(selectedMeeting.id)}` : "/api/summaries", [selectedMeeting]);
    const { data: summaries = [], isLoading: sLoading } = useFetch(summariesUrl);
    const summarize = useMutation({
      mutationFn: async (meeting_id) => {
        const res = await axios.post(API_BASE + "/api/summarize", { meeting_id, force: true });
        return res.data;
      },
      onSuccess: () => {
        qc2.invalidateQueries();
      }
    });
    return /* @__PURE__ */ React.createElement("div", { className: "h-screen flex flex-col" }, /* @__PURE__ */ React.createElement(TopBar, { onSearch: setSearch }), /* @__PURE__ */ React.createElement("div", { className: "flex-1 grid grid-cols-12 gap-4 p-4" }, /* @__PURE__ */ React.createElement(
      Sidebar,
      {
        jurisdictions,
        selected: selectedJurisdiction,
        onSelect: setSelectedJurisdiction,
        loading: jLoading
      }
    ), /* @__PURE__ */ React.createElement(
      MeetingsPane,
      {
        meetings: filteredMeetings,
        selected: selectedMeeting,
        onSelect: setSelectedMeeting,
        loading: mLoading
      }
    ), /* @__PURE__ */ React.createElement(
      SummariesPane,
      {
        summaries,
        meeting: selectedMeeting,
        loading: sLoading,
        onSummarize: () => selectedMeeting && summarize.mutate(selectedMeeting.id)
      }
    )), /* @__PURE__ */ React.createElement(Footer, null));
  }
  function TopBar({ onSearch }) {
    return /* @__PURE__ */ React.createElement("div", { className: "border-b bg-white/70 backdrop-blur sticky top-0 z-10" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-7xl mx-auto flex items-center gap-3 px-4 h-14" }, /* @__PURE__ */ React.createElement("div", { className: "font-bold tracking-tight text-xl" }, "\u{1FAB0} Gadfly"), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-gray-500" }, "Jurisdictions \u2022 Meetings \u2022 Summaries"), /* @__PURE__ */ React.createElement("div", { className: "ml-auto flex items-center gap-2" }, /* @__PURE__ */ React.createElement("input", { placeholder: "Search meetings\u2026", onChange: (e) => onSearch(e.target.value), className: "rounded-xl border px-3 py-1.5 w-72" }), /* @__PURE__ */ React.createElement("a", { href: "#", className: "text-sm underline text-blue-600", onClick: (e) => {
      e.preventDefault();
      location.reload();
    } }, "Refresh"))));
  }
  function Sidebar({ jurisdictions, selected, onSelect, loading }) {
    return /* @__PURE__ */ React.createElement("div", { className: "col-span-3 bg-white rounded-2xl shadow-sm border p-3 flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-2" }, /* @__PURE__ */ React.createElement("h2", { className: "font-semibold" }, "Jurisdictions"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, loading ? "\u2026" : jurisdictions.length)), /* @__PURE__ */ React.createElement("div", { className: "overflow-auto divide-y" }, jurisdictions.map((j) => /* @__PURE__ */ React.createElement("button", { key: j.id, onClick: () => onSelect(j.name || j.id), className: "w-full text-left px-3 py-2 hover:bg-gray-50 " + (selected === (j.name || j.id) ? "bg-gray-100 font-medium" : "") }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", null, j.name || j.id), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, j.meetings ?? 0)), j.url && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-gray-500 truncate" }, j.url))), !jurisdictions.length && !loading && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-gray-500 p-3" }, "No jurisdictions yet.")), /* @__PURE__ */ React.createElement("div", { className: "mt-auto pt-2" }, /* @__PURE__ */ React.createElement(UploadWidget, null)));
  }
  function MeetingsPane({ meetings, selected, onSelect, loading }) {
    return /* @__PURE__ */ React.createElement("div", { className: "col-span-4 bg-white rounded-2xl shadow-sm border p-3 flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-2" }, /* @__PURE__ */ React.createElement("h2", { className: "font-semibold" }, "Meetings"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, loading ? "\u2026" : meetings.length)), /* @__PURE__ */ React.createElement("div", { className: "overflow-auto divide-y" }, meetings.map((m) => /* @__PURE__ */ React.createElement("button", { key: m.id, onClick: () => onSelect(m), className: "w-full text-left px-3 py-2 hover:bg-gray-50 " + (selected?.id === m.id ? "bg-gray-100 font-medium" : "") }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "truncate" }, m.title), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, m.jurisdiction)), m.date && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-gray-500" }, m.date))), !meetings.length && !loading && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-gray-500 p-3" }, "No meetings found.")));
  }
  function SummariesPane({ summaries, meeting, loading, onSummarize }) {
    return /* @__PURE__ */ React.createElement("div", { className: "col-span-5 bg-white rounded-2xl shadow-sm border p-3 flex flex-col" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-2" }, /* @__PURE__ */ React.createElement("h2", { className: "font-semibold" }, "Summaries"), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: onSummarize, disabled: !meeting, className: "px-3 py-1.5 rounded-xl border " + (!meeting ? "opacity-50" : "hover:bg-gray-50") }, "Summarize"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, loading ? "\u2026" : summaries.length))), /* @__PURE__ */ React.createElement("div", { className: "overflow-auto space-y-3" }, meeting && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-gray-500" }, "Meeting: ", meeting.title), summaries.map((s) => /* @__PURE__ */ React.createElement("article", { key: s.id, className: "border rounded-xl p-3" }, /* @__PURE__ */ React.createElement("div", { className: "text-xs text-gray-500 mb-1" }, s.id), /* @__PURE__ */ React.createElement("p", { className: "whitespace-pre-wrap" }, s.preview))), !summaries.length && !loading && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-gray-500 p-3" }, "No summaries yet. Select a meeting and click Summarize.")));
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
      setStatus("Uploading\u2026");
      try {
        await axios.post(API_BASE + "/api/upload", form);
        setStatus("Uploaded!");
      } catch (e) {
        setStatus("Error uploading");
      }
    };
    return /* @__PURE__ */ React.createElement("div", { className: "border rounded-2xl p-3" }, /* @__PURE__ */ React.createElement("div", { className: "font-medium mb-1" }, "Upload PDFs"), /* @__PURE__ */ React.createElement("input", { className: "w-full text-sm", type: "file", accept: "application/pdf", onChange: (e) => setFile(e.target.files[0]) }), /* @__PURE__ */ React.createElement("input", { className: "w-full text-sm border rounded-xl px-2 py-1 mt-2", placeholder: "Jurisdiction (optional)", value: jurisdiction, onChange: (e) => setJurisdiction(e.target.value) }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mt-2" }, /* @__PURE__ */ React.createElement("button", { onClick: onUpload, className: "px-3 py-1.5 rounded-xl border hover:bg-gray-50" }, "Upload"), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-gray-500" }, status)));
  }
  const qc = new QueryClient();
  ReactDOM.createRoot(document.getElementById("root")).render(
    /* @__PURE__ */ React.createElement(QueryClientProvider, { client: qc }, /* @__PURE__ */ React.createElement(App, null))
  );
})();
