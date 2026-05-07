import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

type Tab = "overview" | "articles" | "publishers" | "revenue" | "reader" | "ai" | "pubprogram";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview",   label: "Overview",         icon: "📊" },
  { id: "articles",   label: "Articles",          icon: "📝" },
  { id: "publishers", label: "Publishers",        icon: "👥" },
  { id: "revenue",    label: "CPA & Revenue",     icon: "💰" },
  { id: "reader",     label: "Reader Settings",   icon: "📖" },
  { id: "ai",         label: "AI Setup",          icon: "🤖" },
  { id: "pubprogram", label: "Publisher Program", icon: "⚙️" },
];

const S = {
  page:   { minHeight: "100vh", background: "#f4f4f8", fontFamily: "system-ui,sans-serif", color: "#111" },
  header: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 } as React.CSSProperties,
  logo:   { fontWeight: 800, fontSize: 17, color: "#7c3aed", display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  tabBar: { background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 0, padding: "0 20px", overflowX: "auto" as const },
  tab:    (active: boolean): React.CSSProperties => ({
    padding: "14px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: "none",
    color: active ? "#7c3aed" : "#6b7280", borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent",
    whiteSpace: "nowrap", transition: "color 0.15s",
  }),
  main:   { maxWidth: 1000, margin: "0 auto", padding: "24px 16px" } as React.CSSProperties,
  card:   { background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20, marginBottom: 16 } as React.CSSProperties,
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#111" } as React.CSSProperties,
  label:  { display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 } as React.CSSProperties,
  input:  { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, boxSizing: "border-box", background: "#fff", outline: "none" } as React.CSSProperties,
  textarea: { width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxSizing: "border-box", fontFamily: "monospace", resize: "vertical", background: "#fff", outline: "none" } as React.CSSProperties,
  btn:    { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 } as React.CSSProperties,
  btnSm:  { border: "none", borderRadius: 6, padding: "5px 12px", fontWeight: 600, cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  btnDanger: { background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "5px 12px", fontWeight: 600, cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  btnSuccess: { background: "#d1fae5", color: "#059669", border: "none", borderRadius: 6, padding: "5px 12px", fontWeight: 600, cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  btnGray: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "5px 12px", fontWeight: 600, cursor: "pointer", fontSize: 12 } as React.CSSProperties,
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 20 } as React.CSSProperties,
  stat:   { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px", textAlign: "center" } as React.CSSProperties,
  statN:  { fontSize: 22, fontWeight: 800, color: "#7c3aed" } as React.CSSProperties,
  statL:  { fontSize: 11, color: "#6b7280", marginTop: 2 } as React.CSSProperties,
  table:  { width: "100%", borderCollapse: "collapse" } as React.CSSProperties,
  th:     { padding: "8px 12px", background: "#f9fafb", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#6b7280", borderBottom: "1px solid #e5e7eb" } as React.CSSProperties,
  td:     { padding: "10px 12px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" } as React.CSSProperties,
  row:    { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" } as React.CSSProperties,
  col:    { flex: 1, minWidth: 180 } as React.CSSProperties,
  badge:  (s: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: s === "approved" ? "#d1fae5" : s === "pending" ? "#fef3c7" : s === "rejected" ? "#fee2e2" : s === "Active" ? "#d1fae5" : "#fee2e2",
    color: s === "approved" ? "#059669" : s === "pending" ? "#d97706" : s === "rejected" ? "#dc2626" : s === "Active" ? "#059669" : "#dc2626",
  }),
};

function StatCard({ n, label, sub, warn }: { n: string | number; label: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{ ...S.stat, borderColor: warn ? "#f59e0b" : "#e5e7eb" }}>
      <div style={{ ...S.statN, color: warn ? "#d97706" : "#7c3aed" }}>{n}</div>
      <div style={S.statL}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!pw) return;
    setBusy(true); setErr("");
    try { await api.adminLogin(pw); onDone(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f8" }}>
      <div style={{ ...S.card, maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🛡️</div>
        <p style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Admin Login</p>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Shortlink Admin Panel</p>
        <input type="password" style={S.input} placeholder="Admin password"
          value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} autoFocus />
        {err && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{err}</p>}
        <button style={{ ...S.btn, width: "100%", marginTop: 14 }} onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [rSettings, setRSettings] = useState<any>({});
  const [pSettings, setPSettings] = useState<any>({});
  const [stats, setStats] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [artFilter, setArtFilter] = useState("pending");
  const [artLoading, setArtLoading] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [publishers, setPublishers] = useState<any[]>([]);
  const [pubLoading, setPubLoading] = useState(false);
  const [previewTopic, setPreviewTopic] = useState("");
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [cpaRates, setCpaRates] = useState<Record<string, string>>({
    US: "0.010", GB: "0.008", CA: "0.008", AU: "0.008",
    DE: "0.006", FR: "0.006", DEFAULT: "0.001",
  });
  const [newCountry, setNewCountry] = useState("");

  const showSave = (msg: string) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  useEffect(() => {
    api.adminGetSettings().then((d) => {
      setRSettings(d);
      setAuthed(true);
      api.adminStats().then(setStats).catch(() => {});
    }).catch(() => {});
  }, []);

  const loadPubSettings = useCallback(() => {
    api.adminGetPubSettings().then((d) => {
      setPSettings(d);
      if (d.cpa_rates && typeof d.cpa_rates === "object") {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.cpa_rates)) flat[k] = String(v);
        setCpaRates(prev => ({ ...prev, ...flat }));
      }
    }).catch(() => {});
  }, []);

  const loadArticles = useCallback(() => {
    setArtLoading(true);
    api.adminGetPubArticles(artFilter === "all" ? undefined : artFilter)
      .then(d => setArticles(d.articles || []))
      .catch(() => {})
      .finally(() => setArtLoading(false));
  }, [artFilter]);

  const loadPublishers = useCallback(() => {
    setPubLoading(true);
    api.adminGetPublishers()
      .then(d => setPublishers(d.publishers || []))
      .catch(() => {})
      .finally(() => setPubLoading(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (tab === "overview") api.adminStats().then(setStats).catch(() => {});
    if (tab === "articles") loadArticles();
    if (tab === "publishers") loadPublishers();
    if (tab === "revenue" || tab === "pubprogram") loadPubSettings();
    if (tab === "reader" || tab === "ai") api.adminGetSettings().then(setRSettings).catch(() => {});
  }, [tab, authed, artFilter]);

  const saveReaderSettings = async () => {
    setSaving(true);
    try { await api.adminSaveSettings(rSettings); showSave("✓ Saved!"); }
    catch (e: any) { showSave(`Error: ${e.message}`); }
    finally { setSaving(false); }
  };

  const savePubSettings = async (extra?: any) => {
    setSaving(true);
    const payload = { ...pSettings, ...(extra || {}) };
    try { await api.adminSavePubSettings(payload); showSave("✓ Saved!"); loadPubSettings(); }
    catch (e: any) { showSave(`Error: ${e.message}`); }
    finally { setSaving(false); }
  };

  const saveCpaRates = async () => {
    const rates: Record<string, number> = {};
    for (const [k, v] of Object.entries(cpaRates)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0) rates[k.toUpperCase()] = n;
    }
    await savePubSettings({ cpa_rates: rates });
  };

  const approveArticle = async (id: string) => {
    await api.adminReviewArticle(id, "approve");
    loadArticles();
    api.adminStats().then(setStats).catch(() => {});
  };

  const rejectArticle = async () => {
    if (!rejectId) return;
    await api.adminReviewArticle(rejectId, "reject", rejectReason || undefined);
    setRejectId(null); setRejectReason("");
    loadArticles();
    api.adminStats().then(setStats).catch(() => {});
  };

  const pubAction = async (id: string, action: string, amount?: number) => {
    try {
      await api.adminPublisherAction(id, action, amount);
      loadPublishers();
      api.adminStats().then(setStats).catch(() => {});
    } catch (e: any) { alert(e.message); }
  };

  if (!authed) {
    return <LoginForm onDone={() => {
      setAuthed(true);
      api.adminStats().then(setStats).catch(() => {});
    }} />;
  }

  const r = rSettings;
  const p = pSettings;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>🛡️ Admin Panel</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {saveMsg && (
            <span style={{ fontSize: 12, color: saveMsg.startsWith("Error") ? "#dc2626" : "#059669", fontWeight: 600 }}>
              {saveMsg}
            </span>
          )}
          <a href="/" style={{ fontSize: 12, color: "#6b7280" }}>← Site</a>
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {t.id === "articles" && stats?.pub_articles_pending > 0 && (
              <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>
                {stats.pub_articles_pending}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={S.main}>

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Platform Overview</div>
            {stats ? (
              <>
                <div style={S.statGrid}>
                  <StatCard n={stats.sessions_total} label="Reader Sessions" />
                  <StatCard n={stats.sessions_completed} label="Completed Sessions" />
                  <StatCard n={stats.sessions_today} label="Sessions Today" />
                  <StatCard n={stats.cached_articles} label="Admin Articles" />
                  <StatCard n={stats.publishers_total} label="Total Publishers" />
                  <StatCard n={stats.pub_articles_total} label="Publisher Articles"
                    sub={`${stats.pub_articles_pending} pending`}
                    warn={stats.pub_articles_pending > 0} />
                  <StatCard n={`$${Number(stats.total_pending_balance || 0).toFixed(2)}`} label="On Hold Balance" />
                  <StatCard n={`$${Number(stats.total_available_balance || 0).toFixed(2)}`} label="Available Balance" />
                  <StatCard n={`$${Number(stats.total_lifetime_revenue || 0).toFixed(2)}`} label="Total Revenue" />
                </div>
                {stats.pub_articles_pending > 0 && (
                  <div style={{ ...S.card, borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}>
                    <p style={{ fontWeight: 700, color: "#92400e" }}>
                      ⚠️ {stats.pub_articles_pending} publisher article(s) awaiting your review
                    </p>
                    <button style={{ ...S.btn, marginTop: 10, background: "#d97706" }}
                      onClick={() => setTab("articles")}>
                      Review Now →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: 13 }}>Loading…</p>
            )}
          </>
        )}

        {/* ── ARTICLES (MODERATION) ─────────────────────────────────────────── */}
        {tab === "articles" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Publisher Articles</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["all", "pending", "approved", "rejected"].map(f => (
                  <button key={f} style={{
                    ...S.btnSm,
                    background: artFilter === f ? "#7c3aed" : "#f3f4f6",
                    color: artFilter === f ? "#fff" : "#374151",
                  }} onClick={() => setArtFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {artLoading ? (
              <p style={{ color: "#6b7280", fontSize: 13 }}>Loading…</p>
            ) : articles.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 20px" }}>
                <p style={{ fontSize: 36 }}>📝</p>
                <p style={{ color: "#6b7280", marginTop: 8 }}>
                  No {artFilter === "all" ? "" : artFilter} articles found
                </p>
              </div>
            ) : (
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Article</th>
                      <th style={S.th}>Publisher</th>
                      <th style={S.th}>Date</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map(a => (
                      <tr key={a.id}>
                        <td style={S.td}>
                          <a href={`/p/${a.slug}`} target="_blank" rel="noreferrer"
                            style={{ color: "#7c3aed", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                            {a.title}
                          </a>
                          {a.rejection_reason && (
                            <p style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>
                              ↳ {a.rejection_reason}
                            </p>
                          )}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: "#6b7280", maxWidth: 160 }}>
                          {a.publisher_name}
                        </td>
                        <td style={{ ...S.td, fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" as const }}>
                          {new Date(a.created_at).toLocaleDateString()}
                        </td>
                        <td style={S.td}>
                          <span style={S.badge(a.status)}>{a.status}</span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                            {a.status !== "approved" && (
                              <button style={S.btnSuccess} onClick={() => approveArticle(a.id)}>
                                ✓ Approve
                              </button>
                            )}
                            {a.status !== "rejected" && (
                              <button style={S.btnDanger}
                                onClick={() => { setRejectId(a.id); setRejectReason(""); }}>
                                ✗ Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Reject modal */}
            {rejectId && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
                <div style={{ ...S.card, maxWidth: 440, width: "90%" }}>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>✗ Reject Article</p>
                  <label style={S.label}>Reason (shown to the publisher)</label>
                  <textarea style={{ ...S.textarea, minHeight: 80 }}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Does not meet quality standards. Please expand each section to at least 5,000 characters with original content." />
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button style={{ ...S.btnDanger, padding: "9px 20px" }} onClick={rejectArticle}>
                      Confirm Rejection
                    </button>
                    <button style={S.btnGray} onClick={() => setRejectId(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PUBLISHERS ───────────────────────────────────────────────────── */}
        {tab === "publishers" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Publishers</div>
            {pubLoading ? (
              <p style={{ color: "#6b7280", fontSize: 13 }}>Loading…</p>
            ) : publishers.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 20px" }}>
                <p style={{ fontSize: 36 }}>👥</p>
                <p style={{ color: "#6b7280", marginTop: 8 }}>No publishers yet</p>
              </div>
            ) : (
              <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Publisher</th>
                      <th style={S.th}>Visits</th>
                      <th style={S.th}>On Hold</th>
                      <th style={S.th}>Available</th>
                      <th style={S.th}>Lifetime</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishers.map(pub => (
                      <tr key={pub.id} style={{ opacity: pub.is_blocked ? 0.6 : 1 }}>
                        <td style={S.td}>
                          <p style={{ fontWeight: 600, fontSize: 13 }}>{pub.display_name || pub.email}</p>
                          {pub.display_name && (
                            <p style={{ fontSize: 11, color: "#6b7280" }}>{pub.email}</p>
                          )}
                          <p style={{ fontSize: 10, color: "#9ca3af" }}>
                            Joined {new Date(pub.created_at).toLocaleDateString()}
                          </p>
                          {pub.linked_telegram_id && (
                            <p style={{ fontSize: 10, color: "#7c3aed" }}>
                              TG: {pub.linked_telegram_id}
                            </p>
                          )}
                        </td>
                        <td style={S.td}>{(pub.total_visits || 0).toLocaleString()}</td>
                        <td style={{ ...S.td, color: "#d97706", fontWeight: 700 }}>
                          ${Number(pub.pending_balance || 0).toFixed(4)}
                        </td>
                        <td style={{ ...S.td, color: "#059669", fontWeight: 700 }}>
                          ${Number(pub.available_balance || 0).toFixed(4)}
                        </td>
                        <td style={S.td}>${Number(pub.lifetime_earnings || 0).toFixed(4)}</td>
                        <td style={S.td}>
                          <span style={S.badge(pub.is_blocked ? "rejected" : "Active")}>
                            {pub.is_blocked ? "Blocked" : "Active"}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                            {Number(pub.pending_balance || 0) > 0 && (
                              <button style={S.btnSuccess}
                                title="Move all pending balance to available"
                                onClick={() => {
                                  if (confirm(`Release $${Number(pub.pending_balance).toFixed(4)} for ${pub.email}?`)) {
                                    pubAction(pub.id, "release_balance");
                                  }
                                }}>
                                Release
                              </button>
                            )}
                            {Number(pub.available_balance || 0) > 0 && (
                              <button
                                style={{ ...S.btnSm, background: "#ede9fe", color: "#7c3aed" }}
                                title="Mark as paid out"
                                onClick={() => {
                                  if (confirm(`Mark $${Number(pub.available_balance).toFixed(4)} as paid for ${pub.email}?`)) {
                                    pubAction(pub.id, "mark_paid");
                                  }
                                }}>
                                Mark Paid
                              </button>
                            )}
                            {pub.is_blocked ? (
                              <button style={S.btnSuccess} onClick={() => pubAction(pub.id, "unblock")}>
                                Unblock
                              </button>
                            ) : (
                              <button style={S.btnDanger} onClick={() => {
                                if (confirm(`Block publisher ${pub.email}?`)) pubAction(pub.id, "block");
                              }}>
                                Block
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── CPA & REVENUE ────────────────────────────────────────────────── */}
        {tab === "revenue" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>CPA & Revenue Settings</div>

            <div style={S.card}>
              <div style={S.cardTitle}>Per-Country CPA Rates (USD per unique visit)</div>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
                Set earnings per visit by visitor country code. <strong>DEFAULT</strong> is used when no country-specific rate exists.
                These rates apply to both publisher articles and shortlink visits.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10, marginBottom: 16 }}>
                {Object.entries(cpaRates).map(([country, rate]) => (
                  <div key={country}>
                    <label style={S.label}>{country === "DEFAULT" ? "🌍 DEFAULT (fallback)" : `🏳️‍ ${country}`}</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#6b7280", paddingTop: 9 }}>$</span>
                      <input style={{ ...S.input, flex: 1 }} type="number" step="0.001" min="0"
                        value={rate}
                        onChange={e => setCpaRates(prev => ({ ...prev, [country]: e.target.value }))} />
                      {country !== "DEFAULT" && (
                        <button style={{ ...S.btnDanger, padding: "6px 10px" }}
                          onClick={() => setCpaRates(prev => { const n = { ...prev }; delete n[country]; return n; })}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input style={{ ...S.input, maxWidth: 100 }} placeholder="e.g. SA" maxLength={4}
                  value={newCountry}
                  onChange={e => setNewCountry(e.target.value.toUpperCase())} />
                <button style={S.btnGray} onClick={() => {
                  const c = newCountry.trim().toUpperCase();
                  if (c && !cpaRates[c]) { setCpaRates(prev => ({ ...prev, [c]: "0.001" })); setNewCountry(""); }
                }}>+ Add Country</button>
              </div>
              <button style={S.btn} onClick={saveCpaRates} disabled={saving}>
                {saving ? "Saving…" : "Save CPA Rates"}
              </button>
              {saveMsg && <span style={{ marginLeft: 12, fontSize: 12, color: saveMsg.startsWith("Error") ? "#dc2626" : "#059669" }}>{saveMsg}</span>}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Balance & Payout Rules</div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Hold Period (days)</label>
                  <input style={S.input} type="number" min="0" value={p.hold_days ?? ""}
                    placeholder="e.g. 30"
                    onChange={e => setPSettings((prev: any) => ({ ...prev, hold_days: Number(e.target.value) }))} />
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                    Earnings are held before you release them
                  </p>
                </div>
                <div style={S.col}>
                  <label style={S.label}>Minimum Payout (USD)</label>
                  <input style={S.input} type="number" min="0" step="0.01" value={p.min_payout ?? ""}
                    placeholder="e.g. 5.00"
                    onChange={e => setPSettings((prev: any) => ({ ...prev, min_payout: Number(e.target.value) }))} />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Signup Bonus (USD)</label>
                  <input style={S.input} type="number" min="0" step="0.01" value={p.signup_bonus ?? ""}
                    placeholder="e.g. 0.50"
                    onChange={e => setPSettings((prev: any) => ({ ...prev, signup_bonus: Number(e.target.value) }))} />
                </div>
              </div>
              <button style={{ ...S.btn, marginTop: 16 }} onClick={() => savePubSettings()} disabled={saving}>
                {saving ? "Saving…" : "Save Rules"}
              </button>
              {saveMsg && <span style={{ marginLeft: 12, fontSize: 12, color: saveMsg.startsWith("Error") ? "#dc2626" : "#059669" }}>{saveMsg}</span>}
            </div>
          </>
        )}

        {/* ── READER SETTINGS ──────────────────────────────────────────────── */}
        {tab === "reader" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Reader Settings</div>

            <div style={S.card}>
              <div style={S.cardTitle}>Branding</div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Site Title</label>
                  <input style={S.input} value={r.site_title || ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, site_title: e.target.value }))} />
                </div>
                <div style={{ ...S.col, maxWidth: 220 }}>
                  <label style={S.label}>Brand Color</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="color" value={r.brand_color || "#7c3aed"}
                      onChange={e => setRSettings((s: any) => ({ ...s, brand_color: e.target.value }))}
                      style={{ width: 42, height: 36, border: "1px solid #d1d5db", padding: 2, borderRadius: 8, cursor: "pointer" }} />
                    <input style={{ ...S.input, fontFamily: "monospace" }} value={r.brand_color || "#7c3aed"}
                      onChange={e => setRSettings((s: any) => ({ ...s, brand_color: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Reader Flow</div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Pages per session</label>
                  <input style={S.input} type="number" min="1" max="20" value={r.page_count ?? ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, page_count: Number(e.target.value) }))} />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Wait seconds per page</label>
                  <input style={S.input} type="number" min="0" value={r.wait_seconds ?? ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, wait_seconds: Number(e.target.value) }))} />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Shortlink redirect delay (seconds)</label>
                  <input style={S.input} type="number" min="1" value={r.shortlink_redirect_delay_seconds ?? "10"}
                    onChange={e => setRSettings((s: any) => ({ ...s, shortlink_redirect_delay_seconds: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Ad Slots</div>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 1.6 }}>
                Paste ad network HTML/JS. Script tags execute automatically.
              </p>
              {[
                { k: "ad_head_html",   label: "Head (injected to <head>)" },
                { k: "ad_top_html",    label: "Top of page" },
                { k: "ad_middle_html", label: "Middle of article" },
                { k: "ad_bottom_html", label: "Bottom of page" },
              ].map(({ k, label }) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <label style={S.label}>{label}</label>
                  <textarea style={{ ...S.textarea, minHeight: 70 }} value={r[k] || ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, [k]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button style={S.btn} onClick={saveReaderSettings} disabled={saving}>
                {saving ? "Saving…" : "Save Reader Settings"}
              </button>
              {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith("Error") ? "#dc2626" : "#059669" }}>{saveMsg}</span>}
            </div>
          </>
        )}

        {/* ── AI SETUP ─────────────────────────────────────────────────────── */}
        {tab === "ai" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>AI Article Generation</div>

            <div style={S.card}>
              <div style={S.cardTitle}>AI Provider Configuration</div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Provider</label>
                  <select style={S.input} value={r.ai_provider || "openai"}
                    onChange={e => setRSettings((s: any) => ({ ...s, ai_provider: e.target.value }))}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="gemini">Google Gemini</option>
                  </select>
                </div>
                <div style={{ ...S.col, flex: 2 }}>
                  <label style={S.label}>API Key</label>
                  <input style={S.input} type="password" value={r.ai_api_key || ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, ai_api_key: e.target.value }))}
                    placeholder="sk-…" />
                </div>
              </div>
              <div style={{ ...S.row, marginTop: 12 }}>
                <div style={S.col}>
                  <label style={S.label}>Text Model</label>
                  <input style={S.input} value={r.ai_model || ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, ai_model: e.target.value }))}
                    placeholder="gpt-4o-mini" />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Image Model</label>
                  <input style={S.input} value={r.ai_image_model || ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, ai_image_model: e.target.value }))}
                    placeholder="dall-e-3" />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Output Language</label>
                  <input style={S.input} value={r.ai_language || ""}
                    onChange={e => setRSettings((s: any) => ({ ...s, ai_language: e.target.value }))}
                    placeholder="English" />
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Auto-Generation Topics</div>
              <label style={S.label}>Topics (comma-separated — randomly picked for auto-generation)</label>
              <textarea style={{ ...S.textarea, minHeight: 80 }}
                value={Array.isArray(r.ai_topics) ? r.ai_topics.join(", ") : (r.ai_topics || "")}
                onChange={e => setRSettings((s: any) => ({
                  ...s, ai_topics: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean),
                }))}
                placeholder="technology, health & wellness, personal finance, travel, digital marketing" />
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Test Generation</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input style={{ ...S.input, flex: 1 }} value={previewTopic}
                  onChange={e => setPreviewTopic(e.target.value)}
                  placeholder="Enter a topic to test…"
                  onKeyDown={e => {
                    if (e.key === "Enter" && previewTopic && !previewBusy) {
                      setPreviewBusy(true); setPreviewResult(null);
                      api.adminPreview(previewTopic).then(setPreviewResult)
                        .catch((e2) => setPreviewResult({ error: e2.message }))
                        .finally(() => setPreviewBusy(false));
                    }
                  }} />
                <button style={S.btn} disabled={previewBusy || !previewTopic}
                  onClick={() => {
                    setPreviewBusy(true); setPreviewResult(null);
                    api.adminPreview(previewTopic).then(setPreviewResult)
                      .catch((e2: any) => setPreviewResult({ error: e2.message }))
                      .finally(() => setPreviewBusy(false));
                  }}>
                  {previewBusy ? "Generating…" : "Generate Preview"}
                </button>
              </div>
              {previewResult && (
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
                  {previewResult.error ? (
                    <p style={{ color: "#dc2626", fontSize: 13 }}>⚠ {previewResult.error}</p>
                  ) : (
                    <>
                      {previewResult.image_url && (
                        <img src={previewResult.image_url} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 10, maxHeight: 200, objectFit: "cover" }} />
                      )}
                      <p style={{ fontWeight: 700, marginBottom: 8 }}>{previewResult.title}</p>
                      <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
                        {String(previewResult.content || "").slice(0, 500)}…
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button style={S.btn} onClick={saveReaderSettings} disabled={saving}>
                {saving ? "Saving…" : "Save AI Settings"}
              </button>
              {saveMsg && <span style={{ fontSize: 12, color: saveMsg.startsWith("Error") ? "#dc2626" : "#059669" }}>{saveMsg}</span>}
            </div>
          </>
        )}

        {/* ── PUBLISHER PROGRAM ────────────────────────────────────────────── */}
        {tab === "pubprogram" && (
          <>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Publisher Program Settings</div>

            <div style={S.card}>
              <div style={S.cardTitle}>Program Controls</div>
              {([
                { k: "publishers_enabled",        label: "Publisher Program Enabled",      desc: "Master switch — enables the entire program (articles + shortlinks)" },
                { k: "signup_enabled",            label: "New Registrations Allowed",      desc: "When off, existing publishers can still log in but new ones cannot sign up" },
                { k: "articles_require_approval", label: "Articles Require Approval",      desc: "New publisher articles enter a pending queue before going public" },
              ] as { k: string; label: string; desc: string }[]).map(({ k, label, desc }) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{label}</p>
                    <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{desc}</p>
                  </div>
                  <button
                    style={{
                      background: p[k] !== false ? "#7c3aed" : "#e5e7eb",
                      color: p[k] !== false ? "#fff" : "#374151",
                      border: "none", borderRadius: 99, padding: "7px 22px",
                      fontWeight: 700, cursor: "pointer", fontSize: 13, flexShrink: 0,
                    }}
                    onClick={() => savePubSettings({ [k]: !p[k] })}>
                    {p[k] !== false ? "ON" : "OFF"}
                  </button>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Revenue Defaults</div>
              <div style={S.row}>
                <div style={S.col}>
                  <label style={S.label}>Default Revenue per Visit (USD)</label>
                  <input style={S.input} type="number" min="0" step="0.0001"
                    value={p.revenue_per_visit ?? ""}
                    placeholder="0.0010"
                    onChange={e => setPSettings((prev: any) => ({ ...prev, revenue_per_visit: e.target.value }))} />
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                    Overridden by per-country rates in CPA tab
                  </p>
                </div>
                <div style={S.col}>
                  <label style={S.label}>Signup Bonus (USD)</label>
                  <input style={S.input} type="number" min="0" step="0.01"
                    value={p.signup_bonus ?? ""}
                    placeholder="0.00"
                    onChange={e => setPSettings((prev: any) => ({ ...prev, signup_bonus: e.target.value }))} />
                </div>
                <div style={S.col}>
                  <label style={S.label}>Minimum Payout (USD)</label>
                  <input style={S.input} type="number" min="0" step="0.01"
                    value={p.min_payout ?? ""}
                    placeholder="5.00"
                    onChange={e => setPSettings((prev: any) => ({ ...prev, min_payout: e.target.value }))} />
                </div>
              </div>
              <button style={{ ...S.btn, marginTop: 16 }} onClick={() => savePubSettings()} disabled={saving}>
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {saveMsg && <span style={{ marginLeft: 12, fontSize: 12, color: saveMsg.startsWith("Error") ? "#dc2626" : "#059669" }}>{saveMsg}</span>}
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>Integration Guide</div>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, lineHeight: 1.7 }}>
                Use these values when configuring the Telegram mini-app task:
              </p>
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, fontFamily: "monospace", fontSize: 11, lineHeight: 2, wordBreak: "break-all" as const }}>
                <div><strong>redirect_url:</strong> {typeof window !== "undefined" ? window.location.origin : "https://your-site.vercel.app"}/?u={"{user_id}"}&t={"{token}"}</div>
                <div><strong>verify_url:</strong> {typeof window !== "undefined" ? window.location.origin : "https://your-site.vercel.app"}/api/verify</div>
                <div><strong>body_template:</strong> {"{ \"user_id\": \"{user_id}\", \"token\": \"{token}\", \"code\": \"{code}\" }"}</div>
                <div><strong>success_key:</strong> ok &nbsp;·&nbsp; <strong>success_value:</strong> true</div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
