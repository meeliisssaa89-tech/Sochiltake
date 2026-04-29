import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  pubApi, hasPubToken, AiModelLite, ArticleSection,
} from "../lib/publisherApi";

interface SectionState extends ArticleSection {
  // local-only flag to keep React keys stable across re-orders
  uid: string;
}

const blankSection = (): SectionState => ({
  uid: Math.random().toString(36).slice(2),
  title: "",
  content: "",
  image_url: "",
});

export default function PubEditorPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const editing = !!id && id !== "new";

  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [sections, setSections] = useState<SectionState[]>(
    [blankSection(), blankSection(), blankSection()]
  );
  const [activeTab, setActiveTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [minSections, setMinSections] = useState(3);
  const [minChars, setMinChars] = useState(5000);

  // AI helpers
  const [aiModels, setAiModels] = useState<AiModelLite[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPubToken()) { nav("/publisher/login"); return; }
    document.title = editing ? "Edit article" : "New article";

    pubApi.status().then((s) => {
      setMinSections(s.min_sections || 3);
      setMinChars(s.min_section_chars || 5000);
      // top up so we always have at least minSections empty slots
      setSections((prev) => {
        if (prev.length >= s.min_sections) return prev;
        const out = [...prev];
        while (out.length < s.min_sections) out.push(blankSection());
        return out;
      });
    }).catch(() => { /* ignore */ });

    pubApi.listAiModels()
      .then((r) => {
        setAiModels(r.models || []);
        const def = (r.models || []).find((m) => m.is_default) || (r.models || [])[0];
        if (def) setSelectedModelId(def.id);
      })
      .catch(() => { /* AI is optional */ });

    if (editing) {
      pubApi.listArticles().then((r) => {
        const a = r.articles.find((x) => x.id === id);
        if (a) {
          setTitle(a.title);
          setCoverUrl(a.cover_url || "");
          if (Array.isArray(a.sections) && a.sections.length > 0) {
            setSections(a.sections.map((s: any) => ({
              uid: Math.random().toString(36).slice(2),
              title: s.title || "",
              content: s.content || "",
              image_url: s.image_url || "",
            })));
          }
        }
        setLoading(false);
      }).catch((e) => { setErr(e.message); setLoading(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateSection = (idx: number, patch: Partial<SectionState>) => {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const addSection = () => {
    setSections((prev) => [...prev, blankSection()]);
    setActiveTab(sections.length); // focus the new tab
  };

  const removeSection = (idx: number) => {
    if (sections.length <= minSections) {
      setErr(`At least ${minSections} sections (tabs) are required.`);
      return;
    }
    if (!confirm(`Delete section "${sections[idx].title || idx + 1}"?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== idx));
    setActiveTab((t) => Math.max(0, Math.min(t, sections.length - 2)));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setActiveTab(j);
  };

  const totalChars = useMemo(
    () => sections.reduce((s, x) => s + (x.content?.length || 0), 0),
    [sections]
  );

  const validate = (): string | null => {
    if (title.trim().length < 4) return "Article title must be at least 4 characters.";
    if (sections.length < minSections) return `At least ${minSections} sections are required.`;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if ((s.title || "").trim().length < 3) return `Section ${i + 1}: title is required.`;
      if ((s.content || "").length < minChars) {
        return `Section ${i + 1}: needs at least ${minChars.toLocaleString()} characters (currently ${(s.content || "").length.toLocaleString()}).`;
      }
      if (!(s.image_url || "").trim()) return `Section ${i + 1}: an image URL is required.`;
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
          title: title.trim(),
          content,
          image_url: (image_url || "").trim(),
        })),
      };
      if (editing) {
        await pubApi.updateArticle(id!, payload);
      } else {
        await pubApi.createArticle(payload);
      }
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const aiGenerate = async () => {
    setAiErr(null);
    if (aiTopic.trim().length < 3) { setAiErr("Enter a topic (3+ chars)."); return; }
    setAiBusy(true);
    try {
      const r = await pubApi.aiGenerate(aiTopic.trim(), selectedModelId || undefined);
      const a = r.article;
      if (!title.trim()) setTitle(a.title || "");
      if (!coverUrl && a.cover_url) setCoverUrl(a.cover_url);
      const next = (a.sections || []).map((s) => ({
        uid: Math.random().toString(36).slice(2),
        title: s.title || "",
        content: s.content || "",
        image_url: s.image_url || "",
      }));
      // Top up to min sections in case the model returned fewer
      while (next.length < minSections) next.push(blankSection());
      setSections(next);
      setActiveTab(0);
    } catch (e: any) {
      setAiErr(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-center text-sm">Loading…</p>;

  const current = sections[activeTab] || sections[0];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h1 className="font-bold text-lg">
            {editing ? "Edit article" : "Write a new article"}
          </h1>
          <Link to="/publisher/dashboard" className="text-xs text-gray-500">← Back</Link>
        </div>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-[11px] text-gray-500 font-medium">Article title</label>
            <input
              className="input text-base font-semibold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="A clear, compelling headline…"
              data-testid="input-article-title"
            />
          </div>

          {/* Cover */}
          <div>
            <label className="text-[11px] text-gray-500 font-medium">Cover image URL</label>
            <input
              className="input"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…/cover.jpg (optional — falls back to section 1's image)"
            />
            {coverUrl && (
              <div className="mt-2">
                <img src={coverUrl} alt="cover preview"
                  className="w-full max-h-40 object-cover rounded-lg border border-gray-200"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI assistant */}
      {aiModels.length > 0 && (
        <div className="card bg-purple-50/60 border-purple-200">
          <p className="text-sm font-bold text-purple-700 mb-2">✨ AI assistant</p>
          <p className="text-[11px] text-gray-600 mb-2">
            Pick a topic and let AI draft all the sections for you. You can edit everything afterwards.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              className="input"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              data-testid="select-ai-model"
            >
              {aiModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} ({m.provider}){m.is_default ? " ★" : ""}
                </option>
              ))}
            </select>
            <input
              className="input md:col-span-2"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Topic / brief, e.g. 'The future of AI in healthcare'"
              data-testid="input-ai-topic"
            />
          </div>
          <button
            onClick={aiGenerate}
            disabled={aiBusy}
            className="btn-brand mt-2 w-full md:w-auto"
            data-testid="button-ai-generate"
          >
            {aiBusy ? "Generating… (this can take ~30-60s)" : "Generate full article"}
          </button>
          {aiErr && <p className="text-xs text-red-600 mt-2">{aiErr}</p>}
        </div>
      )}

      {/* Tabs */}
      <div className="card">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-sm font-bold">
            Sections (tabs) — minimum {minSections}, each with {minChars.toLocaleString()}+ chars and an image
          </p>
          <button onClick={addSection} className="text-xs px-3 py-1 rounded-md bg-purple-600 text-white" data-testid="button-add-section">
            + Add tab
          </button>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {sections.map((s, i) => {
            const isOk = (s.content?.length || 0) >= minChars && !!s.image_url && (s.title || "").trim().length >= 3;
            return (
              <button
                key={s.uid}
                onClick={() => setActiveTab(i)}
                className={`shrink-0 text-xs px-3 py-2 rounded-md border transition-colors ${
                  activeTab === i
                    ? "bg-purple-600 text-white border-purple-600"
                    : isOk
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
                data-testid={`tab-section-${i}`}
              >
                <span className="font-semibold">{i + 1}.</span> {s.title?.slice(0, 22) || `Section ${i + 1}`}
                {isOk && <span className="ms-1">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Active tab editor */}
        {current && (
          <div className="space-y-3 mt-2 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500">
                Editing <strong>section {activeTab + 1}</strong> of {sections.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => moveSection(activeTab, -1)} disabled={activeTab === 0}
                  className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                  ← Move left
                </button>
                <button onClick={() => moveSection(activeTab, 1)} disabled={activeTab >= sections.length - 1}
                  className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                  Move right →
                </button>
                <button onClick={() => removeSection(activeTab)}
                  className="text-[11px] px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                  data-testid={`button-remove-section-${activeTab}`}>
                  Delete tab
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 font-medium">Section title (H2)</label>
              <input
                className="input font-semibold"
                value={current.title}
                onChange={(e) => updateSection(activeTab, { title: e.target.value })}
                placeholder="e.g. 'Why this matters now'"
                data-testid={`input-section-title-${activeTab}`}
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-500 font-medium">Section image URL (required)</label>
              <input
                className="input"
                value={current.image_url || ""}
                onChange={(e) => updateSection(activeTab, { image_url: e.target.value })}
                placeholder="https://…/section.jpg"
                data-testid={`input-section-image-${activeTab}`}
              />
              {current.image_url && (
                <div className="mt-2">
                  <img src={current.image_url} alt={current.title}
                    className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] text-gray-500 font-medium">
                Body — supports plain text and simple **bold** / *italic* formatting.
              </label>
              <textarea
                className="input font-mono text-sm leading-relaxed"
                value={current.content}
                onChange={(e) => updateSection(activeTab, { content: e.target.value })}
                rows={20}
                placeholder={`Write at least ${minChars.toLocaleString()} characters here…\n\nUse blank lines to separate paragraphs.`}
                data-testid={`textarea-section-content-${activeTab}`}
              />
              <div className="flex items-center justify-between mt-1">
                <p className={`text-[11px] ${
                  (current.content?.length || 0) >= minChars ? "text-green-600 font-semibold" : "text-gray-500"
                }`}>
                  {(current.content?.length || 0).toLocaleString()} / {minChars.toLocaleString()} characters
                  {(current.content?.length || 0) >= minChars && " ✓"}
                </p>
                <p className="text-[11px] text-gray-400">
                  Tip: split long ideas into short paragraphs for readability.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
          <span>Total length across all sections:</span>
          <span className="font-bold">{totalChars.toLocaleString()} characters</span>
        </div>
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">{err}</p>}
        <button onClick={save} className="btn-brand w-full" disabled={busy} data-testid="button-save-article">
          {busy ? "Saving…" : (editing ? "Update article" : "Publish article")}
        </button>
        <p className="text-[10px] text-gray-500 text-center mt-2">
          New & edited articles may need admin approval before going public.
        </p>
      </div>
    </div>
  );
}
