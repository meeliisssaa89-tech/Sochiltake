import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { pubApi, hasPubToken, AiModelLite, ArticleSection, PubShortlink } from "../lib/publisherApi";

interface SectionState extends ArticleSection { uid: string; }
const blankSection = (): SectionState => ({
  uid: Math.random().toString(36).slice(2),
  title: "", content: "", image_url: "",
});

// ── Rich text toolbar ──────────────────────────────────────────────
type ToolbarAction = { label: string; title: string; wrap?: [string,string]; prefix?: string; };
const TOOLBAR: ToolbarAction[] = [
  { label: "B",  title: "Bold",        wrap: ["**","**"] },
  { label: "I",  title: "Italic",      wrap: ["*","*"] },
  { label: "H2", title: "Heading 2",   prefix: "## " },
  { label: "H3", title: "Heading 3",   prefix: "### " },
  { label: "❝",  title: "Blockquote",  prefix: "> " },
  { label: "`",  title: "Inline code", wrap: ["`","`"] },
];

function RichTextarea({
  value, onChange, rows = 18, placeholder, testId,
}: {
  value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string; testId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (action: ToolbarAction) => {
    const el = ref.current; if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const sel   = value.slice(start, end);
    let next = value;
    let cursor = start;
    if (action.wrap) {
      const [open, close] = action.wrap;
      next   = value.slice(0, start) + open + sel + close + value.slice(end);
      cursor = sel ? end + open.length + close.length : start + open.length;
    } else if (action.prefix) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line      = value.slice(lineStart, end);
      next   = value.slice(0, lineStart) + action.prefix + line + value.slice(end);
      cursor = end + action.prefix.length;
    }
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const insertLink = () => {
    const url   = prompt("Enter URL (https://…)");
    if (!url) return;
    const label = prompt("Link label") || url;
    const el    = ref.current; if (!el) return;
    const ins   = `[${label}](${url})`;
    const s     = el.selectionStart;
    onChange(value.slice(0, s) + ins + value.slice(el.selectionEnd));
    setTimeout(() => { el.focus(); el.setSelectionRange(s + ins.length, s + ins.length); }, 0);
  };

  return (
    <div>
      <div className="editor-toolbar">
        {TOOLBAR.map((a) => (
          <button key={a.label} type="button" title={a.title} className="toolbar-btn"
            onMouseDown={(e) => { e.preventDefault(); applyFormat(a); }}>
            {a.label}
          </button>
        ))}
        <div className="toolbar-sep" />
        <button type="button" title="Insert link" className="toolbar-btn"
          onMouseDown={(e) => { e.preventDefault(); insertLink(); }}>
          🔗
        </button>
        <div className="toolbar-sep" />
        <span className="text-xs ml-1" style={{ color: "var(--text-3)" }}>Markdown supported</span>
      </div>
      <textarea
        ref={ref}
        className="editor-area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        data-testid={testId}
      />
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────
export default function PubEditorPage() {
  const { id } = useParams<{ id: string }>();
  const nav    = useNavigate();
  const editing = !!id && id !== "new";

  const [title,      setTitle]      = useState("");
  const [coverUrl,   setCoverUrl]   = useState("");
  const [sections,   setSections]   = useState<SectionState[]>([blankSection(), blankSection(), blankSection()]);
  const [activeTab,  setActiveTab]  = useState(0);
  const [linkedCode, setLinkedCode] = useState<string>("");   // linked shortlink code
  const [shortlinks, setShortlinks] = useState<PubShortlink[]>([]);
  const [busy,       setBusy]       = useState(false);
  const [err,        setErr]        = useState<string | null>(null);
  const [loading,    setLoading]    = useState(editing);
  const [minSections,setMinSections]= useState(3);
  const [minChars,   setMinChars]   = useState(5000);
  const [aiModels,   setAiModels]   = useState<AiModelLite[]>([]);
  const [selectedModel,setSelectedModel] = useState("");
  const [aiTopic,    setAiTopic]    = useState("");
  const [aiBusy,     setAiBusy]     = useState(false);
  const [aiErr,      setAiErr]      = useState<string | null>(null);

  useEffect(() => {
    if (!hasPubToken()) { nav("/publisher/login"); return; }
    document.title = editing ? "Edit Article" : "New Article";

    Promise.all([
      pubApi.status(),
      pubApi.listAiModels().catch(() => ({ models: [] })),
      pubApi.listShortlinks().catch(() => ({ shortlinks: [], site_url: "" })),
    ]).then(([st, ai, sl]) => {
      setMinSections(st.min_sections || 3);
      setMinChars(st.min_section_chars || 5000);
      setSections((prev) => {
        if (prev.length >= (st.min_sections || 3)) return prev;
        const out = [...prev];
        while (out.length < st.min_sections) out.push(blankSection());
        return out;
      });
      setAiModels(ai.models || []);
      const def = (ai.models || []).find((m) => m.is_default) || (ai.models || [])[0];
      if (def) setSelectedModel(def.id);
      setShortlinks((sl.shortlinks || []).filter((s) => s.is_active));
    }).catch(() => {});

    if (editing) {
      pubApi.listArticles().then((r) => {
        const a = r.articles.find((x) => x.id === id);
        if (a) {
          setTitle(a.title);
          setCoverUrl(a.cover_url || "");
          setLinkedCode(a.linked_shortlink_code || "");
          if (Array.isArray(a.sections) && a.sections.length > 0) {
            setSections(a.sections.map((s: any) => ({
              uid: Math.random().toString(36).slice(2),
              title: s.title || "", content: s.content || "", image_url: s.image_url || "",
            })));
          }
        }
        setLoading(false);
      }).catch((e) => { setErr(e.message); setLoading(false); });
    }
  }, [id]);

  const updateSection = (idx: number, patch: Partial<SectionState>) =>
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const addSection = () => {
    setSections((prev) => [...prev, blankSection()]);
    setActiveTab(sections.length);
  };

  const removeSection = (idx: number) => {
    if (sections.length <= minSections) { setErr(`At least ${minSections} sections required.`); return; }
    if (!confirm(`Delete section "${sections[idx].title || idx + 1}"?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== idx));
    setActiveTab((t) => Math.max(0, Math.min(t, sections.length - 2)));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    setSections((prev) => { const next = [...prev]; [next[idx], next[j]] = [next[j], next[idx]]; return next; });
    setActiveTab(j);
  };

  const totalChars = useMemo(
    () => sections.reduce((s, x) => s + (x.content?.length || 0), 0),
    [sections],
  );

  const validate = (): string | null => {
    if (title.trim().length < 4) return "Title must be at least 4 characters.";
    if (sections.length < minSections) return `At least ${minSections} sections required.`;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if ((s.title || "").trim().length < 3) return `Section ${i+1}: title is required (3+ chars).`;
      if ((s.content || "").length < minChars) return `Section ${i+1}: needs at least ${minChars.toLocaleString()} characters (has ${(s.content||"").length.toLocaleString()}).`;
      if (!(s.image_url || "").trim()) return `Section ${i+1}: an image URL is required.`;
    }
    return null;
  };

  const save = async () => {
    setErr(null);
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        cover_url: (coverUrl || sections[0]?.image_url || "").trim() || null,
        sections: sections.map(({ title, content, image_url }) => ({
          title: title.trim(), content, image_url: (image_url || "").trim(),
        })),
        linked_shortlink_code: linkedCode || null,
      };
      if (editing) { await pubApi.updateArticle(id!, payload); }
      else         { await pubApi.createArticle(payload); }
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  const aiGenerate = async () => {
    setAiErr(null);
    if (aiTopic.trim().length < 3) { setAiErr("Enter a topic (3+ chars)."); return; }
    setAiBusy(true);
    try {
      const r = await pubApi.aiGenerate(aiTopic.trim(), selectedModel || undefined);
      const a = r.article;
      if (!title.trim()) setTitle(a.title || "");
      if (!coverUrl && a.cover_url) setCoverUrl(a.cover_url);
      const next = (a.sections || []).map((s) => ({
        uid: Math.random().toString(36).slice(2),
        title: s.title || "", content: s.content || "", image_url: s.image_url || "",
      }));
      while (next.length < minSections) next.push(blankSection());
      setSections(next); setActiveTab(0);
    } catch (e: any) { setAiErr(e.message); }
    finally { setAiBusy(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
    </div>
  );

  const current = sections[activeTab] || sections[0];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="site-header">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/publisher/dashboard" className="btn-ghost text-xs py-1.5 px-3">← Dashboard</Link>
            <span className="font-bold">{editing ? "Edit Article" : "New Article"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:block" style={{ color: totalChars >= minSections * minChars ? "var(--success)" : "var(--text-3)" }}>
              {totalChars.toLocaleString()} chars
            </span>
            <button onClick={save} disabled={busy} className="btn-brand text-sm py-2 px-5" data-testid="button-save-article">
              {busy ? "Saving…" : (editing ? "Update" : "Publish")}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">

        {/* AI assistant */}
        {aiModels.length > 0 && (
          <div className="glass p-5 space-y-3" style={{ border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.06)" }}>
            <div className="flex items-center gap-2">
              <span>✨</span>
              <p className="font-semibold text-sm" style={{ color: "#c4b5fd" }}>AI Writing Assistant</p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-2)" }}>Enter a topic and let AI generate the full article for you. You can edit everything afterwards.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select className="input select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} data-testid="select-ai-model" style={{ flex: "0 0 auto", width: "auto", minWidth: 160 }}>
                {aiModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name}{m.is_default ? " ★" : ""}</option>
                ))}
              </select>
              <input className="input flex-1" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Topic — e.g. 'The future of AI in healthcare'" data-testid="input-ai-topic" />
              <button onClick={aiGenerate} disabled={aiBusy} className="btn-brand text-sm py-2 px-4 flex-shrink-0" data-testid="button-ai-generate">
                {aiBusy ? "Generating…" : "Generate"}
              </button>
            </div>
            {aiErr && <p className="text-xs text-red-400">{aiErr}</p>}
          </div>
        )}

        {/* Article meta */}
        <div className="glass p-6 space-y-4">
          <h2 className="font-bold mb-1">Article Details</h2>

          {/* Title */}
          <div>
            <label className="label">Article Title *</label>
            <input className="input text-lg font-semibold" value={title} onChange={(e) => setTitle(e.target.value)}
              maxLength={200} placeholder="A clear, compelling headline…" data-testid="input-article-title" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cover image */}
            <div>
              <label className="label">Cover Image URL</label>
              <input className="input" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://…/cover.jpg (optional)" />
              {coverUrl && (
                <img src={coverUrl} alt="cover" onError={(e) => { (e.currentTarget as any).style.display="none"; }}
                  className="mt-2 w-full h-28 object-cover rounded-xl" />
              )}
            </div>

            {/* Attach shortlink */}
            <div>
              <label className="label">Attach Shortlink <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
              <select className="input" value={linkedCode} onChange={(e) => setLinkedCode(e.target.value)} data-testid="select-linked-shortlink">
                <option value="">— None (show task code at end) —</option>
                {shortlinks.map((sl) => (
                  <option key={sl.id} value={sl.short_code}>
                    {sl.title || sl.short_code} → {sl.original_url.slice(0, 40)}…
                  </option>
                ))}
              </select>
              {linkedCode ? (
                <p className="text-xs mt-1.5" style={{ color: "var(--brand)" }}>
                  ✓ Last page will redirect readers through this shortlink
                </p>
              ) : (
                <p className="text-xs mt-1.5" style={{ color: "var(--text-3)" }}>
                  Attach a shortlink to earn extra from redirects at the end of the article
                </p>
              )}
              {shortlinks.length === 0 && (
                <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                  <Link to="/publisher/shortlinks" style={{ color: "var(--brand)" }}>Create a shortlink</Link> first to attach it here.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section editor */}
        <div className="glass p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold">Sections (Pages)</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Minimum {minSections} sections, each with {minChars.toLocaleString()}+ characters and an image</p>
            </div>
            <button onClick={addSection} className="btn-brand text-xs py-2 px-4" data-testid="button-add-section">+ Add Section</button>
          </div>

          {/* Section tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {sections.map((s, i) => {
              const isOk  = (s.content?.length || 0) >= minChars && !!s.image_url && (s.title||"").trim().length >= 3;
              const active = activeTab === i;
              return (
                <button key={s.uid} onClick={() => setActiveTab(i)}
                  className="shrink-0 text-xs px-3 py-2 rounded-xl transition-all"
                  style={{
                    background: active ? "var(--brand)" : isOk ? "rgba(34,197,94,0.1)" : "var(--surface-2)",
                    border: `1px solid ${active ? "var(--brand)" : isOk ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                    color: active ? "#fff" : isOk ? "#4ade80" : "var(--text-2)",
                  }}
                  data-testid={`tab-section-${i}`}>
                  {i+1}. {(s.title?.slice(0,18) || `Section ${i+1}`)}
                  {isOk && !active && " ✓"}
                </button>
              );
            })}
          </div>

          {/* Active section */}
          {current && (
            <div className="space-y-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              {/* Section controls */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>
                  Section <strong style={{ color: "var(--text-1)" }}>{activeTab+1}</strong> of {sections.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveSection(activeTab, -1)} disabled={activeTab === 0} className="btn-ghost text-xs py-1.5 px-3">← Move</button>
                  <button onClick={() => moveSection(activeTab,  1)} disabled={activeTab >= sections.length-1} className="btn-ghost text-xs py-1.5 px-3">Move →</button>
                  <button onClick={() => removeSection(activeTab)} className="btn-ghost text-xs py-1.5 px-3" style={{ color: "var(--danger)", borderColor: "rgba(244,63,94,0.3)" }} data-testid={`button-remove-section-${activeTab}`}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Section title */}
              <div>
                <label className="label">Section Title (H2) *</label>
                <input className="input font-semibold" value={current.title}
                  onChange={(e) => updateSection(activeTab, { title: e.target.value })}
                  placeholder="e.g. 'Why this matters now'"
                  data-testid={`input-section-title-${activeTab}`} />
              </div>

              {/* Section image */}
              <div>
                <label className="label">Section Image URL *</label>
                <input className="input" value={current.image_url || ""}
                  onChange={(e) => updateSection(activeTab, { image_url: e.target.value })}
                  placeholder="https://…/image.jpg"
                  data-testid={`input-section-image-${activeTab}`} />
                {current.image_url && (
                  <img src={current.image_url} alt="" onError={(e) => { (e.currentTarget as any).style.display="none"; }}
                    className="mt-2 w-full h-36 object-cover rounded-xl" />
                )}
              </div>

              {/* Rich text body */}
              <div>
                <label className="label">Body Content *</label>
                <RichTextarea
                  value={current.content}
                  onChange={(v) => updateSection(activeTab, { content: v })}
                  rows={20}
                  placeholder={`Write at least ${minChars.toLocaleString()} characters…\n\nSupports Markdown: **bold**, *italic*, ## Heading, > quote, \`code\`, [link](url)\n\nTip: Use blank lines to separate paragraphs.`}
                  testId={`textarea-section-content-${activeTab}`}
                />
                <div className="flex justify-between mt-1.5 text-xs">
                  <span style={{ color: (current.content?.length||0) >= minChars ? "var(--success)" : "var(--text-3)" }}>
                    {(current.content?.length||0).toLocaleString()} / {minChars.toLocaleString()} chars
                    {(current.content?.length||0) >= minChars && " ✓"}
                  </span>
                  <span style={{ color: "var(--text-3)" }}>Total across all: {totalChars.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save */}
        {err && <div className="px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">{err}</div>}
        <div className="glass p-5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            {editing ? "Edited articles go back into review." : "New articles need admin approval before going public."}
          </p>
          <button onClick={save} disabled={busy} className="btn-brand py-3 px-8" data-testid="button-save-article-bottom">
            {busy ? "Saving…" : (editing ? "Update Article" : "Publish Article")}
          </button>
        </div>
      </main>
    </div>
  );
}
