import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { pubApi, PubShortlink } from "../lib/publisherApi";

export default function PubShortlinksPage() {
  const nav = useNavigate();
  const [links, setLinks] = useState<PubShortlink[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", original_url: "" });
  const [formErr, setFormErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const brand = "#7c3aed";

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
      setFormErr("الرابط يجب أن يبدأ بـ https://"); return;
    }
    setCreating(true);
    try {
      await pubApi.createShortlink(url, form.title.trim() || undefined);
      setForm({ title: "", original_url: "" });
      await load();
    } catch (e: any) {
      setFormErr(e?.message || "فشل إنشاء الرابط");
    } finally { setCreating(false); }
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا الرابط نهائيًا؟")) return;
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

  const s: Record<string, React.CSSProperties> = {
    page: { minHeight: "100vh", background: "#0f0f13", color: "#e5e7eb", fontFamily: "system-ui,sans-serif", padding: "24px 16px", maxWidth: 700, margin: "0 auto" },
    header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 24 },
    backBtn: { background: "none", border: "1px solid #374151", color: "#9ca3af", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
    card: { background: "#1a1a2e", borderRadius: 14, padding: "18px 20px", marginBottom: 16, border: "1px solid #2d2d4a" },
    label: { fontSize: 11, color: "#6b7280", marginBottom: 4, display: "block" },
    input: { width: "100%", background: "#111827", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", color: "#e5e7eb", fontSize: 14, boxSizing: "border-box" },
    btn: { background: brand, color: "#fff", border: "none", borderRadius: 9, padding: "10px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 },
    btnOutline: { background: "transparent", color: brand, border: `1px solid ${brand}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
    linkCard: { background: "#111827", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid #1f2937" },
    shortUrl: { fontSize: 13, color: brand, fontFamily: "monospace", wordBreak: "break-all" },
    stat: { fontSize: 12, color: "#6b7280" },
    statVal: { fontSize: 14, fontWeight: 700, color: "#e5e7eb" },
    error: { color: "#f87171", fontSize: 13, marginTop: 6 },
    row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  };

  const badgeStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11,
    background: active ? "#14532d33" : "#7f1d1d33",
    color: active ? "#4ade80" : "#f87171",
  });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => nav("/publisher/dashboard")}>← لوحة التحكم</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🔗 اختصار الروابط</h1>
      </div>

      {/* Create form */}
      <div style={s.card}>
        <p style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>رابط جديد</p>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={s.label}>اسم أو وصف (اختياري)</label>
            <input style={s.input} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: كوبون خصم أمازون" />
          </div>
          <div>
            <label style={s.label}>الرابط الأصلي *</label>
            <input style={s.input} value={form.original_url} dir="ltr"
              onChange={(e) => setForm({ ...form, original_url: e.target.value })}
              placeholder="https://example.com/very-long-link"
              onKeyDown={(e) => e.key === "Enter" && create()} />
          </div>
          {formErr && <p style={s.error}>{formErr}</p>}
          <button style={{ ...s.btn, opacity: creating ? 0.7 : 1 }}
            onClick={create} disabled={creating}>
            {creating ? "جارٍ الإنشاء…" : "اختصر الرابط"}
          </button>
        </div>
      </div>

      {/* Coming soon API banner */}
      <div style={{ ...s.card, borderColor: `${brand}44`, background: `${brand}0d`, marginBottom: 24 }}>
        <div style={s.row}>
          <span style={{ fontSize: 22 }}>🚀</span>
          <div>
            <p style={{ fontWeight: 700, margin: 0, fontSize: 14, color: "#c4b5fd" }}>قريبًا: API مدفوع للمطوّرين</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0", lineHeight: 1.6 }}>
              ستتمكّن من اختصار الروابط تلقائيًا من بوتاتك وتطبيقاتك بمفتاح واحد، وإنشاء مهام الكود في تطبيقنا مباشرةً.
            </p>
          </div>
        </div>
      </div>

      {/* Links list */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "40px 0" }}>جارٍ التحميل…</p>
      ) : links.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#4b5563" }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>🔗</p>
          <p>لا توجد روابط مختصرة بعد. أنشئ أول رابط أعلاه.</p>
        </div>
      ) : (
        links.map((lk) => (
          <div key={lk.id} style={s.linkCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {lk.title && <p style={{ fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>{lk.title}</p>}
                <p style={s.shortUrl}>{lk.short_url}</p>
                <p style={{ fontSize: 11, color: "#4b5563", margin: "4px 0 0", wordBreak: "break-all" }}>
                  → {lk.original_url.length > 70 ? lk.original_url.slice(0, 70) + "…" : lk.original_url}
                </p>
              </div>
              <span style={badgeStyle(lk.is_active)}>{lk.is_active ? "نشط" : "معطّل"}</span>
            </div>

            <div style={{ display: "flex", gap: 20, margin: "10px 0" }}>
              <div><p style={s.stat}>الزيارات</p><p style={s.statVal}>{lk.visit_count.toLocaleString("ar-EG")}</p></div>
              <div><p style={s.stat}>الأرباح</p><p style={s.statVal}>{Number(lk.earnings).toFixed(4)}</p></div>
              <div><p style={s.stat}>التاريخ</p><p style={s.statVal}>{new Date(lk.created_at).toLocaleDateString("ar-EG")}</p></div>
            </div>

            <div style={s.row}>
              <button style={{ ...s.btn, padding: "7px 16px", fontSize: 12 }}
                onClick={() => copy(lk.short_url, lk.id)}>
                {copied === lk.id ? "✓ تم النسخ" : "نسخ الرابط"}
              </button>
              <button style={s.btnOutline} onClick={() => toggle(lk.id)}>
                {lk.is_active ? "تعطيل" : "تفعيل"}
              </button>
              <a href={lk.short_url} target="_blank" rel="noreferrer"
                style={{ ...s.btnOutline, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                معاينة ↗
              </a>
              <button
                style={{ ...s.btnOutline, color: "#f87171", borderColor: "#f87171", marginInlineStart: "auto" }}
                onClick={() => del(lk.id)}>
                حذف
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
