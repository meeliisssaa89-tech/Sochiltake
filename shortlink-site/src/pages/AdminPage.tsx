import { useEffect, useState } from "react";
import { api } from "../lib/api";

type AdminTab = "settings" | "articles";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await api.adminGetSettings();
        setAuthed(true);
      } catch {
        /* not authed yet */
      }
    })();
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    setLoading(true);
    try {
      await api.adminLogin(pw);
      setAuthed(true);
    } catch (e: any) {
      setLoginErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={login} className="card max-w-sm w-full">
          <h1 className="text-xl font-bold mb-1">Admin</h1>
          <p className="text-sm text-gray-500 mb-4">
            First login? The password you enter becomes the admin password.
          </p>
          <label className="label">Password</label>
          <input
            type="password"
            className="input mb-3"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            required
            minLength={4}
            data-testid="input-admin-password"
          />
          {loginErr && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-3">
              {loginErr}
            </p>
          )}
          <button className="btn-brand w-full" disabled={loading} data-testid="button-admin-login">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("settings");
  const [settings, setSettings] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [topicsText, setTopicsText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, st] = await Promise.all([api.adminGetSettings(), api.adminStats()]);
        setSettings(s);
        setStats(st);
        setTopicsText((s.ai_topics || []).join(", "));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (!settings) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  const update = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const topics = topicsText.split(",").map((t) => t.trim()).filter(Boolean);
      await api.adminSaveSettings({ ...settings, ai_topics: topics });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreviewing(true);
    setPreviewErr(null);
    setPreview(null);
    try {
      const topic = (topicsText.split(",")[0] || "technology").trim();
      const a = await api.adminPreview(topic);
      setPreview(a);
    } catch (e: any) {
      setPreviewErr(e.message);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold shrink-0">Shortlink Admin</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-1.5 font-medium transition-colors ${activeTab === "settings" ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab("articles")}
                className={`px-4 py-1.5 font-medium transition-colors border-l ${activeTab === "articles" ? "bg-purple-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                Articles
              </button>
            </div>
            {activeTab === "settings" && (
              <button className="btn-brand" onClick={save} disabled={saving} data-testid="button-save-settings">
                {saving ? "Saving…" : savedAt ? "Saved ✓" : "Save"}
              </button>
            )}
          </div>
        </div>
      </header>

      {activeTab === "settings" && (
        <main className="max-w-5xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-4">
          {/* Stats */}
          <section className="card lg:col-span-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Sessions total" value={stats?.sessions_total} />
              <Stat label="Completed" value={stats?.sessions_completed} />
              <Stat label="Today" value={stats?.sessions_today} />
              <Stat label="Cached articles" value={stats?.cached_articles} />
            </div>
          </section>

          {/* Admin-only articles toggle */}
          <section className="card lg:col-span-3 border-l-4 border-purple-500 bg-purple-50">
            <h2 className="text-sm font-semibold text-purple-900 mb-2">🔒 Admin-Only Articles Mode</h2>
            <p className="text-xs text-purple-700 mb-3">
              When enabled, only you (admin) can write articles with tasks. Publisher signup/linking is hidden from users.
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-purple-600"
                checked={!!settings.admin_only_articles}
                onChange={(e) => update("admin_only_articles", e.target.checked)}
              />
              <span className="text-sm font-medium text-purple-900">
                {settings.admin_only_articles
                  ? "✓ Enabled — only admin can create articles"
                  : "Disabled — publishers can create articles"}
              </span>
            </label>
            {settings.admin_only_articles && (
              <p className="mt-2 text-xs text-purple-600 bg-purple-100 rounded p-2">
                Go to the <strong>Articles</strong> tab to create and manage articles directly.
              </p>
            )}
          </section>

          {/* Pages & timer */}
          <section className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Flow</h2>
            <label className="label">Number of pages</label>
            <input
              type="number" min={1} max={20} className="input mb-3"
              value={settings.page_count}
              onChange={(e) => update("page_count", Number(e.target.value))}
              data-testid="input-page-count"
            />
            <label className="label">Wait between pages (seconds)</label>
            <input
              type="number" min={0} max={120} className="input mb-3"
              value={settings.wait_seconds}
              onChange={(e) => update("wait_seconds", Number(e.target.value))}
              data-testid="input-wait-seconds"
            />
          </section>

          {/* Branding */}
          <section className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Branding</h2>
            <label className="label">Site title</label>
            <input className="input mb-3" value={settings.site_title || ""} onChange={(e) => update("site_title", e.target.value)} />
            <label className="label">Brand color</label>
            <div className="flex items-center gap-2 mb-3">
              <input type="color" value={settings.brand_color || "#7c3aed"}
                onChange={(e) => update("brand_color", e.target.value)} className="h-9 w-12 rounded cursor-pointer" />
              <input className="input" value={settings.brand_color || ""} onChange={(e) => update("brand_color", e.target.value)} />
            </div>
          </section>

          {/* Publishers */}
          <section className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Publishers</h2>
            <Toggle label="Publishers enabled" checked={!!settings.publishers_enabled} onChange={(v) => update("publishers_enabled", v)} />
            <Toggle label="Signup open" checked={!!settings.signup_enabled} onChange={(v) => update("signup_enabled", v)} />
            <Toggle label="Payouts enabled" checked={!!settings.payouts_enabled} onChange={(v) => update("payouts_enabled", v)} />
            <Toggle label="Articles require approval" checked={!!settings.articles_require_approval} onChange={(v) => update("articles_require_approval", v)} />
            <label className="label mt-2">Revenue per visit ($)</label>
            <input type="number" step="0.0001" min="0" className="input mb-2"
              value={settings.revenue_per_visit ?? 0} onChange={(e) => update("revenue_per_visit", Number(e.target.value))} />
            <label className="label">Min payout ($)</label>
            <input type="number" step="0.01" min="0" className="input"
              value={settings.min_payout ?? 1} onChange={(e) => update("min_payout", Number(e.target.value))} />
          </section>

          {/* AI */}
          <section className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">AI articles</h2>
            <label className="label">Provider</label>
            <select className="input mb-3" value={settings.ai_provider || "openai"} onChange={(e) => update("ai_provider", e.target.value)}>
              <option value="openai">OpenAI</option>
            </select>
            <label className="label">API key</label>
            <input type="password" className="input mb-3" value={settings.ai_api_key || ""}
              onChange={(e) => update("ai_api_key", e.target.value)} placeholder="sk-…" data-testid="input-ai-key" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Text model</label>
                <input className="input" value={settings.ai_model || ""} onChange={(e) => update("ai_model", e.target.value)} placeholder="gpt-4o-mini" />
              </div>
              <div>
                <label className="label">Image model</label>
                <input className="input" value={settings.ai_image_model || ""} onChange={(e) => update("ai_image_model", e.target.value)} placeholder="dall-e-3" />
              </div>
            </div>
            <label className="label">Language</label>
            <input className="input mb-3" value={settings.ai_language || "en"} onChange={(e) => update("ai_language", e.target.value)} placeholder="en, ar, fr…" />
            <label className="label">Topics (comma-separated)</label>
            <textarea className="input mb-3 min-h-[70px]" value={topicsText} onChange={(e) => setTopicsText(e.target.value)} />
            <button type="button" onClick={runPreview} disabled={previewing} className="btn-brand w-full" data-testid="button-preview-ai">
              {previewing ? "Generating…" : "Test AI generation"}
            </button>
            {previewErr && <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{previewErr}</p>}
            {preview && (
              <div className="mt-3 border rounded-lg p-3 text-sm">
                <p className="font-semibold mb-1">{preview.title}</p>
                <p className="text-gray-600 whitespace-pre-line line-clamp-6">{preview.content}</p>
                {preview.image_url && <img src={preview.image_url} alt="" className="mt-2 rounded w-full max-h-40 object-cover" />}
              </div>
            )}
          </section>

          {/* Ad slots */}
          <section className="card lg:col-span-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Ad slots</h2>
            <p className="text-xs text-gray-500 mb-3">Paste raw HTML / script tags from your ad network.</p>
            <div className="grid md:grid-cols-2 gap-3">
              <AdField label="Head (loaded once)" value={settings.ad_head_html} onChange={(v) => update("ad_head_html", v)} />
              <AdField label="Top of article" value={settings.ad_top_html} onChange={(v) => update("ad_top_html", v)} />
              <AdField label="Middle of article" value={settings.ad_middle_html} onChange={(v) => update("ad_middle_html", v)} />
              <AdField label="Bottom of article" value={settings.ad_bottom_html} onChange={(v) => update("ad_bottom_html", v)} />
            </div>
          </section>

          {/* Integration help */}
          <section className="card lg:col-span-3 bg-purple-50 border-purple-200">
            <h2 className="text-sm font-semibold text-purple-900 mb-2">Connect to the main app</h2>
            <ol className="text-xs text-purple-900 space-y-1 list-decimal list-inside">
              <li>In the main app's admin, create a task of type <b>code_api</b>.</li>
              <li>Set <b>redirect_url</b> to: <code className="bg-white px-1 rounded">https://YOUR-SITE/?u={"{{user_id}}"}&amp;t={"{{token}}"}</code></li>
              <li>Set <b>verify_url</b> to: <code className="bg-white px-1 rounded">https://YOUR-SITE/api/verify</code></li>
              <li>Set <b>body_template</b> to: <code className="bg-white px-1 rounded">{`{ "user_id": "{{user_id}}", "code": "{{code}}", "token": "{{token}}" }`}</code></li>
              <li>Set <b>success_key</b> to <code className="bg-white px-1 rounded">success</code> and <b>success_value</b> to <code className="bg-white px-1 rounded">true</code>.</li>
            </ol>
          </section>
        </main>
      )}

      {activeTab === "articles" && <AdminArticlesTab />}
    </div>
  );
}

/* ─── Admin Articles Tab ─────────────────────────────────────────────── */
interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  visit_count: number;
  created_at: string;
  sections?: any[];
  cover_url?: string | null;
}

const BLANK_SECTION = () => ({ uid: Math.random().toString(36).slice(2), title: "", content: "", image_url: "" });

function AdminArticlesTab() {
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminArticle | null | "new">(null);

  const loadArticles = async () => {
    setLoadingList(true);
    setListErr(null);
    try {
      const r = await api.adminArticles("list");
      setArticles(r.articles || []);
    } catch (e: any) {
      setListErr(e.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadArticles(); }, []);

  const deleteArticle = async (id: string) => {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    try {
      await api.adminArticles("delete", { id });
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (editing !== null) {
    return (
      <AdminArticleEditor
        article={editing === "new" ? null : editing}
        onDone={() => { setEditing(null); loadArticles(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Admin Articles</h2>
        <button className="btn-brand" onClick={() => setEditing("new")}>+ New Article</button>
      </div>

      {loadingList && <p className="text-gray-400 text-sm">Loading…</p>}
      {listErr && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{listErr}</p>}

      {!loadingList && articles.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <p className="mb-3">No articles yet.</p>
          <button className="btn-brand" onClick={() => setEditing("new")}>Create your first article</button>
        </div>
      )}

      <div className="grid gap-3">
        {articles.map((a) => (
          <div key={a.id} className="card flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{a.title || "(Untitled)"}</p>
              <p className="text-xs text-gray-400">
                {new Date(a.created_at).toLocaleDateString()} · {a.visit_count} visits
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  a.status === "approved" ? "bg-green-100 text-green-700"
                  : a.status === "rejected" ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
                }`}>{a.status}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="text-xs text-blue-600 hover:underline" onClick={() => setEditing(a)}>Edit</button>
              <button className="text-xs text-red-500 hover:underline" onClick={() => deleteArticle(a.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminArticleEditor({ article, onDone, onCancel }: {
  article: AdminArticle | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(article?.title || "");
  const [coverUrl, setCoverUrl] = useState(article?.cover_url || "");
  const [sections, setSections] = useState<any[]>(
    article?.sections && article.sections.length > 0
      ? article.sections.map((s: any) => ({ ...s, uid: Math.random().toString(36).slice(2) }))
      : [BLANK_SECTION(), BLANK_SECTION(), BLANK_SECTION()]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const updateSection = (uid: string, field: string, val: string) => {
    setSections((prev) => prev.map((s) => s.uid === uid ? { ...s, [field]: val } : s));
  };

  const addSection = () => setSections((prev) => [...prev, BLANK_SECTION()]);
  const removeSection = (uid: string) => setSections((prev) => prev.filter((s) => s.uid !== uid));

  const save = async () => {
    if (!title.trim()) { setErr("Article title is required"); return; }
    const secs = sections.filter((s) => s.title.trim() || s.content.trim());
    if (secs.length === 0) { setErr("Add at least one section with content"); return; }
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        title: title.trim(),
        cover_url: coverUrl.trim() || null,
        sections: secs.map(({ uid: _uid, ...rest }) => rest),
      };
      if (article) {
        await api.adminArticles("update", { id: article.id, ...payload });
      } else {
        await api.adminArticles("create", payload);
      }
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
        <h2 className="text-lg font-bold flex-1">{article ? "Edit Article" : "New Article"}</h2>
        <button onClick={save} disabled={saving} className="btn-brand">
          {saving ? "Saving…" : "Save Article"}
        </button>
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</p>}

      <div className="card space-y-3">
        <div>
          <label className="label">Title *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title…" />
        </div>
        <div>
          <label className="label">Cover image URL (optional)</label>
          <input className="input" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
          {coverUrl && <img src={coverUrl} alt="cover" className="mt-2 rounded w-full max-h-40 object-cover" onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />}
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={s.uid} className="card space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Section {i + 1}</p>
              {sections.length > 1 && (
                <button onClick={() => removeSection(s.uid)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              )}
            </div>
            <input
              className="input"
              placeholder="Section title…"
              value={s.title}
              onChange={(e) => updateSection(s.uid, "title", e.target.value)}
            />
            <textarea
              className="input min-h-[120px]"
              placeholder="Section content (Markdown supported: **bold**, # Heading, ![img](url), [link](url))…"
              value={s.content}
              onChange={(e) => updateSection(s.uid, "content", e.target.value)}
            />
            <input
              className="input"
              placeholder="Section image URL (optional)…"
              value={s.image_url || ""}
              onChange={(e) => updateSection(s.uid, "image_url", e.target.value)}
            />
          </div>
        ))}
      </div>

      <button onClick={addSection} className="w-full border-2 border-dashed border-gray-300 hover:border-purple-400 text-gray-400 hover:text-purple-600 rounded-xl py-3 text-sm font-medium transition-colors">
        + Add Section
      </button>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-gray-50 border p-3">
      <div className="text-2xl font-bold">{value ?? "—"}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer mb-2">
      <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function AdField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input min-h-[110px] font-mono text-xs" value={value || ""}
        onChange={(e) => onChange(e.target.value)} placeholder="<script>...</script>" />
    </div>
  );
}
