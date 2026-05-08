import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, PubShortlink } from "../lib/publisherApi";

export default function PubShortlinksPage() {
  const nav = useNavigate();
  const [links, setLinks]     = useState<PubShortlink[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm]       = useState({ title: "", original_url: "" });
  const [formErr, setFormErr] = useState("");
  const [copied, setCopied]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await pubApi.listShortlinks();
      setLinks(d.shortlinks || []);
      setSiteUrl(d.site_url || "");
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("sign") || e?.status === 401) {
        nav("/publisher/login");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); document.title = "My Shortlinks"; }, []);

  const create = async () => {
    setFormErr("");
    const url = form.original_url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setFormErr("URL must start with https://"); return;
    }
    setCreating(true);
    try {
      await pubApi.createShortlink(url, form.title.trim() || undefined);
      setForm({ title: "", original_url: "" });
      await load();
    } catch (e: any) {
      setFormErr(e?.message || "Failed to create shortlink");
    } finally { setCreating(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this shortlink permanently?")) return;
    await pubApi.deleteShortlink(id);
    setLinks((l) => l.filter((x) => x.id !== id));
  };

  const toggle = async (id: string) => {
    const res = await pubApi.toggleShortlink(id);
    setLinks((l) => l.map((x) => x.id === id ? { ...x, is_active: res.is_active } : x));
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="site-header">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/publisher/dashboard" className="btn-ghost text-xs py-1.5 px-3">← Dashboard</Link>
            <span className="font-bold">Shortlinks</span>
          </div>
          <span className="text-sm" style={{ color: "var(--text-3)" }}>{links.length} link{links.length !== 1 ? "s" : ""}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        {/* Create form */}
        <div className="glass-strong p-6 space-y-4">
          <div>
            <h2 className="font-bold">Create a Shortlink</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Paste any URL — we'll shorten it and display ads before redirecting visitors.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Title <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input className="input" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Amazon discount coupon" />
            </div>
            <div>
              <label className="label">Destination URL *</label>
              <input className="input" value={form.original_url} dir="ltr"
                onChange={(e) => setForm({ ...form, original_url: e.target.value })}
                placeholder="https://example.com/your-link"
                onKeyDown={(e) => e.key === "Enter" && create()} />
            </div>
          </div>
          {formErr && <p className="text-xs text-red-400">{formErr}</p>}
          <button className="btn-brand" onClick={create} disabled={creating} data-testid="button-create-shortlink">
            {creating ? "Creating…" : "Create Shortlink →"}
          </button>
        </div>

        {/* API coming soon banner */}
        <div className="glass p-5 flex items-start gap-4" style={{ border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.06)" }}>
          <span className="text-2xl">🚀</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: "#c4b5fd" }}>Coming Soon: Shortlink API</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>
              Auto-generate and manage shortlinks from your Telegram bots or any platform via a single API key. No manual work required.
            </p>
          </div>
        </div>

        {/* Links list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
          </div>
        ) : links.length === 0 ? (
          <div className="glass p-10 text-center">
            <p className="text-4xl mb-3">🔗</p>
            <p className="font-semibold mb-1">No shortlinks yet</p>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>Create your first shortlink above to start earning from redirects.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((lk) => (
              <div key={lk.id} className="glass p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    {lk.title && <p className="font-semibold mb-1">{lk.title}</p>}
                    <p className="text-sm font-mono break-all" style={{ color: "var(--brand)" }}>{lk.short_url}</p>
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--text-3)" }}>→ {lk.original_url}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${lk.is_active ? "badge-green" : "badge-red"}`}>{lk.is_active ? "Active" : "Paused"}</span>
                </div>

                <div className="flex gap-5 my-3">
                  {[
                    { label: "Visits", value: lk.visit_count.toLocaleString() },
                    { label: "Earned", value: Number(lk.earnings).toFixed(4) },
                    { label: "Created", value: new Date(lk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-xs" style={{ color: "var(--text-3)" }}>{s.label}</p>
                      <p className="font-bold text-sm">{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <button className="btn-brand text-xs py-2 px-4" onClick={() => copy(lk.short_url, lk.id)}>
                    {copied === lk.id ? "✓ Copied!" : "Copy Link"}
                  </button>
                  <button className="btn-ghost text-xs py-2 px-4" onClick={() => toggle(lk.id)}>
                    {lk.is_active ? "Pause" : "Resume"}
                  </button>
                  <a href={lk.short_url} target="_blank" rel="noreferrer" className="btn-ghost text-xs py-2 px-4">
                    Preview ↗
                  </a>
                  <button className="btn-ghost text-xs py-2 px-4 ml-auto" onClick={() => del(lk.id)} style={{ color: "var(--danger)", borderColor: "rgba(244,63,94,0.3)" }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
