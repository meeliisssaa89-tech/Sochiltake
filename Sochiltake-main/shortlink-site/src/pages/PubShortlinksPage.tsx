import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { pubApi, PubShortlink } from "../lib/publisherApi";

const BRAND = "#7c3aed";

const S = {
  page: { minHeight: "100vh", background: "#f8f8fc", fontFamily: "system-ui,sans-serif", color: "#111" } as React.CSSProperties,
  header: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 } as React.CSSProperties,
  logo: { fontWeight: 800, fontSize: 16, color: BRAND } as React.CSSProperties,
  main: { maxWidth: 780, margin: "0 auto", padding: "24px 16px" } as React.CSSProperties,
  card: { background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 16 } as React.CSSProperties,
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 } as React.CSSProperties,
  input: { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff", outline: "none" } as React.CSSProperties,
  btn: { background: BRAND, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 } as React.CSSProperties,
  btnSm: (color?: string): React.CSSProperties => ({
    background: color ? `${color}18` : "#f3f4f6", color: color || "#374151",
    border: `1px solid ${color ? color + "33" : "#e5e7eb"}`, borderRadius: 8, padding: "5px 12px",
    fontWeight: 600, cursor: "pointer", fontSize: 12,
  }),
  linkCard: { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: "1px solid #e5e7eb" } as React.CSSProperties,
  badge: (active: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: active ? "#d1fae5" : "#fee2e2",
    color: active ? "#059669" : "#dc2626",
  }),
};

export default function PubShortlinksPage() {
  const nav = useNavigate();
  const [links, setLinks] = useState<PubShortlink[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", original_url: "" });
  const [formErr, setFormErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await pubApi.listShortlinks();
      setLinks(d.shortlinks || []);
      setSiteUrl(d.site_url || "");
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes("sign") || e?.status === 401) {
        nav("/publisher/login");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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
    setLinks(l => l.filter(x => x.id !== id));
  };

  const toggle = async (id: string) => {
    const res = await pubApi.toggleShortlink(id);
    setLinks(l => l.map(x => x.id === id ? { ...x, is_active: res.is_active } : x));
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>✦ Publisher Portal</div>
        <button
          style={{ background: "none", border: "1px solid #e5e7eb", color: "#6b7280", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}
          onClick={() => nav("/publisher/dashboard")}>
          ← Dashboard
        </button>
      </div>

      <div style={S.main}>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 20 }}>🔗 Link Shortener</div>

        {/* Create form */}
        <div style={S.card}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Create Short Link</p>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={S.label}>Label (optional)</label>
              <input style={S.input} value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Amazon affiliate link" />
            </div>
            <div>
              <label style={S.label}>Destination URL *</label>
              <input style={S.input} value={form.original_url}
                onChange={e => setForm({ ...form, original_url: e.target.value })}
                placeholder="https://example.com/your-long-link"
                onKeyDown={e => e.key === "Enter" && create()} />
            </div>
            {formErr && <p style={{ color: "#dc2626", fontSize: 13 }}>{formErr}</p>}
            <button style={{ ...S.btn, opacity: creating ? 0.7 : 1 }}
              onClick={create} disabled={creating}>
              {creating ? "Creating…" : "Shorten & Earn →"}
            </button>
          </div>
        </div>

        {/* How it works banner */}
        <div style={{ ...S.card, background: "linear-gradient(135deg, #7c3aed11, #a855f711)", border: "1px solid #c4b5fd", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#5b21b6", marginBottom: 4 }}>
                How shortlinks earn you money
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
                When someone visits your short link, they read a short article before being redirected to your destination.
                You earn a CPA payment for every unique visit — rates vary by country.
              </p>
            </div>
          </div>
        </div>

        {/* Links list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${BRAND}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : links.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>No shortlinks yet</p>
            <p style={{ fontSize: 13, color: "#6b7280" }}>Create your first shortlink above to start earning.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
              {links.length} link{links.length !== 1 ? "s" : ""}
            </p>
            {links.map(lk => (
              <div key={lk.id} style={S.linkCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {lk.title && (
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{lk.title}</p>
                    )}
                    <p style={{ fontSize: 13, color: BRAND, fontFamily: "monospace", wordBreak: "break-all", fontWeight: 600 }}>
                      {lk.short_url}
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, wordBreak: "break-all" }}>
                      → {lk.original_url.length > 65 ? lk.original_url.slice(0, 65) + "…" : lk.original_url}
                    </p>
                  </div>
                  <span style={S.badge(lk.is_active)}>{lk.is_active ? "Active" : "Paused"}</span>
                </div>

                <div style={{ display: "flex", gap: 20, padding: "8px 0", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, color: "#9ca3af" }}>Visits</p>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{lk.visit_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "#9ca3af" }}>Earned</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: BRAND }}>${Number(lk.earnings).toFixed(4)}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: "#9ca3af" }}>Created</p>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      {new Date(lk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={S.btnSm(BRAND)}
                    onClick={() => copy(lk.short_url, lk.id)}>
                    {copied === lk.id ? "✓ Copied!" : "Copy Link"}
                  </button>
                  <button style={S.btnSm()} onClick={() => toggle(lk.id)}>
                    {lk.is_active ? "Pause" : "Resume"}
                  </button>
                  <a href={lk.short_url} target="_blank" rel="noreferrer"
                    style={{ ...S.btnSm(), textDecoration: "none" }}>
                    Preview ↗
                  </a>
                  <button
                    style={{ ...S.btnSm("#ef4444"), marginLeft: "auto" }}
                    onClick={() => del(lk.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
