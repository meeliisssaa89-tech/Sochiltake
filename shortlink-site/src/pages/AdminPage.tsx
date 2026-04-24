import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // On mount: try fetching settings — if it works we're already authed (cookie)
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
      const topics = topicsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">Shortlink Admin</h1>
          <button className="btn-brand" onClick={save} disabled={saving} data-testid="button-save-settings">
            {saving ? "Saving…" : savedAt ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      </header>

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

        {/* Pages & timer */}
        <section className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Flow</h2>
          <label className="label">Number of pages</label>
          <input
            type="number"
            min={1}
            max={20}
            className="input mb-3"
            value={settings.page_count}
            onChange={(e) => update("page_count", Number(e.target.value))}
            data-testid="input-page-count"
          />
          <label className="label">Wait between pages (seconds)</label>
          <input
            type="number"
            min={0}
            max={120}
            className="input mb-3"
            value={settings.wait_seconds}
            onChange={(e) => update("wait_seconds", Number(e.target.value))}
            data-testid="input-wait-seconds"
          />
        </section>

        {/* Branding */}
        <section className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Branding</h2>
          <label className="label">Site title</label>
          <input
            className="input mb-3"
            value={settings.site_title || ""}
            onChange={(e) => update("site_title", e.target.value)}
          />
          <label className="label">Brand color</label>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="color"
              value={settings.brand_color || "#7c3aed"}
              onChange={(e) => update("brand_color", e.target.value)}
              className="h-9 w-12 rounded cursor-pointer"
            />
            <input
              className="input"
              value={settings.brand_color || ""}
              onChange={(e) => update("brand_color", e.target.value)}
            />
          </div>
        </section>

        {/* AI */}
        <section className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">AI articles</h2>
          <label className="label">Provider</label>
          <select
            className="input mb-3"
            value={settings.ai_provider || "openai"}
            onChange={(e) => update("ai_provider", e.target.value)}
          >
            <option value="openai">OpenAI</option>
          </select>
          <label className="label">API key</label>
          <input
            type="password"
            className="input mb-3"
            value={settings.ai_api_key || ""}
            onChange={(e) => update("ai_api_key", e.target.value)}
            placeholder="sk-…"
            data-testid="input-ai-key"
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Text model</label>
              <input
                className="input"
                value={settings.ai_model || ""}
                onChange={(e) => update("ai_model", e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div>
              <label className="label">Image model</label>
              <input
                className="input"
                value={settings.ai_image_model || ""}
                onChange={(e) => update("ai_image_model", e.target.value)}
                placeholder="dall-e-3"
              />
            </div>
          </div>
          <label className="label">Language</label>
          <input
            className="input mb-3"
            value={settings.ai_language || "en"}
            onChange={(e) => update("ai_language", e.target.value)}
            placeholder="en, ar, fr…"
          />
          <label className="label">Topics (comma-separated)</label>
          <textarea
            className="input mb-3 min-h-[70px]"
            value={topicsText}
            onChange={(e) => setTopicsText(e.target.value)}
          />
          <button
            type="button"
            onClick={runPreview}
            disabled={previewing}
            className="btn-brand w-full"
            data-testid="button-preview-ai"
          >
            {previewing ? "Generating…" : "Test AI generation"}
          </button>
          {previewErr && (
            <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {previewErr}
            </p>
          )}
          {preview && (
            <div className="mt-3 border rounded-lg p-3 text-sm">
              <p className="font-semibold mb-1">{preview.title}</p>
              <p className="text-gray-600 whitespace-pre-line line-clamp-6">{preview.content}</p>
              {preview.image_url && (
                <img src={preview.image_url} alt="" className="mt-2 rounded w-full max-h-40 object-cover" />
              )}
            </div>
          )}
        </section>

        {/* Ad slots */}
        <section className="card lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Ad slots</h2>
          <p className="text-xs text-gray-500 mb-3">
            Paste raw HTML / script tags from your ad network (Adsterra, PropellerAds,
            Monetag, Google AdSense, etc.). Each slot renders in a different position.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <AdField
              label="Head (loaded once, e.g. ad SDK script)"
              value={settings.ad_head_html}
              onChange={(v) => update("ad_head_html", v)}
            />
            <AdField
              label="Top of article"
              value={settings.ad_top_html}
              onChange={(v) => update("ad_top_html", v)}
            />
            <AdField
              label="Middle of article"
              value={settings.ad_middle_html}
              onChange={(v) => update("ad_middle_html", v)}
            />
            <AdField
              label="Bottom of article"
              value={settings.ad_bottom_html}
              onChange={(v) => update("ad_bottom_html", v)}
            />
          </div>
        </section>

        {/* Integration help */}
        <section className="card lg:col-span-3 bg-purple-50 border-purple-200">
          <h2 className="text-sm font-semibold text-purple-900 mb-2">Connect to the main app</h2>
          <ol className="text-xs text-purple-900 space-y-1 list-decimal list-inside">
            <li>In the main app's admin, create a task of type <b>code_api</b>.</li>
            <li>
              Set <b>redirect_url</b> to:{" "}
              <code className="bg-white px-1 rounded">
                https://YOUR-SITE/?u={"{{user_id}}"}&amp;t={"{{token}}"}
              </code>
            </li>
            <li>
              Set <b>verify_url</b> to:{" "}
              <code className="bg-white px-1 rounded">https://YOUR-SITE/api/verify</code>
            </li>
            <li>
              Set <b>body_template</b> to:{" "}
              <code className="bg-white px-1 rounded">{`{ "user_id": "{{user_id}}", "code": "{{code}}", "token": "{{token}}" }`}</code>
            </li>
            <li>
              Set <b>success_key</b> to <code className="bg-white px-1 rounded">success</code> and{" "}
              <b>success_value</b> to <code className="bg-white px-1 rounded">true</code>.
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-gray-50 border p-3">
      <div className="text-2xl font-bold">{value ?? "—"}</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function AdField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input min-h-[110px] font-mono text-xs"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="<script>...</script>"
      />
    </div>
  );
}
