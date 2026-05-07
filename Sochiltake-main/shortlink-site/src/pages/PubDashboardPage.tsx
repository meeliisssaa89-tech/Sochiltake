import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, clearPubToken, hasPubToken, Publisher, PubArticle } from "../lib/publisherApi";

const BRAND = "#7c3aed";

const S = {
  page: { minHeight: "100vh", background: "#f8f8fc", fontFamily: "system-ui,sans-serif", color: "#111" } as React.CSSProperties,
  header: { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 } as React.CSSProperties,
  logo: { fontWeight: 800, fontSize: 16, color: BRAND } as React.CSSProperties,
  main: { maxWidth: 800, margin: "0 auto", padding: "24px 16px" } as React.CSSProperties,
  card: { background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 16 } as React.CSSProperties,
  statCard: (accent?: string): React.CSSProperties => ({
    background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px 16px", textAlign: "center",
    borderTop: `3px solid ${accent || BRAND}`,
  }),
  btn: { background: BRAND, color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14, display: "inline-block", textDecoration: "none" } as React.CSSProperties,
  btnOutline: { background: "#fff", color: BRAND, border: `1.5px solid ${BRAND}`, borderRadius: 10, padding: "8px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13, display: "inline-block", textDecoration: "none" } as React.CSSProperties,
  actionCard: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, textAlign: "center", textDecoration: "none", color: "inherit", transition: "border-color 0.15s, box-shadow 0.15s", display: "block" } as React.CSSProperties,
  badge: (s: string): React.CSSProperties => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
    background: s === "approved" ? "#d1fae5" : s === "pending" ? "#fef3c7" : "#fee2e2",
    color: s === "approved" ? "#059669" : s === "pending" ? "#d97706" : "#dc2626",
  }),
};

function StatCard({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent?: string }) {
  return (
    <div style={S.statCard(accent)}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || BRAND }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export default function PubDashboardPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<Publisher | null>(null);
  const [articles, setArticles] = useState<PubArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState("USDT TRC-20");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  useEffect(() => {
    if (!hasPubToken()) { nav("/publisher/login"); return; }
    document.title = "Publisher Dashboard";
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await pubApi.me();
      setMe(r.publisher);
      setArticles(r.articles);
    } catch (e: any) {
      setErr(e.message);
      if (String(e.message || "").toLowerCase().includes("sign")) {
        clearPubToken();
        nav("/publisher/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    try { await pubApi.logout(); } catch { /* ignore */ }
    clearPubToken();
    nav("/publisher/login");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    await pubApi.deleteArticle(id);
    refresh();
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const submitPayout = async () => {
    if (!payoutDetails.trim()) return;
    setPayoutBusy(true); setPayoutMsg("");
    try {
      const r = await pubApi.requestPayout(payoutMethod, payoutDetails);
      setPayoutMsg(r.message || "Payout request sent!");
      setShowPayout(false);
    } catch (e: any) {
      setPayoutMsg(`Error: ${e.message}`);
    } finally {
      setPayoutBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${BRAND}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const available = Number(me?.available_balance || 0);
  const pending = Number(me?.pending_balance || 0);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>✦ Publisher Portal</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{me?.display_name || me?.email}</span>
          <button onClick={onLogout}
            style={{ background: "none", border: "1px solid #e5e7eb", color: "#6b7280", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={S.main}>
        {err && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            {err}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
          <StatCard value={`$${available.toFixed(4)}`} label="Available Balance" accent="#059669"
            sub={available > 0 ? "Ready for payout" : "Nothing available yet"} />
          <StatCard value={`$${pending.toFixed(4)}`} label="On Hold" accent="#d97706"
            sub="Pending admin release" />
          <StatCard value={`$${Number(me?.lifetime_earnings || 0).toFixed(4)}`} label="Lifetime Earnings" />
          <StatCard value={(me?.total_visits || 0).toLocaleString()} label="Total Visits" />
        </div>

        {/* Payout request */}
        {available > 0 && (
          <div style={{ ...S.card, borderLeft: "4px solid #059669", background: "#f0fdf4" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ fontWeight: 700, color: "#065f46" }}>
                  💸 ${available.toFixed(4)} available for payout
                </p>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  Your funds have been released. Request a payout now.
                </p>
              </div>
              <button
                style={{ ...S.btn, background: "#059669" }}
                onClick={() => setShowPayout(true)}>
                Request Payout
              </button>
            </div>
            {payoutMsg && (
              <p style={{ fontSize: 12, marginTop: 10, color: payoutMsg.startsWith("Error") ? "#dc2626" : "#059669" }}>
                {payoutMsg}
              </p>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <Link to="/publisher/article/new" style={{ ...S.actionCard }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✍️</div>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Write Article</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>Earn from every reader visit</p>
          </Link>
          <Link to="/publisher/shortlinks" style={{ ...S.actionCard }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🔗</div>
            <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Shorten Link</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>Monetize any URL instantly</p>
          </Link>
        </div>

        {/* Encouragement banner */}
        <div style={{ ...S.card, background: "linear-gradient(135deg, #7c3aed11, #a855f711)", border: "1px solid #c4b5fd" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 28 }}>🚀</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#5b21b6", marginBottom: 4 }}>
                Write More, Earn More
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                Publishers who write 5+ approved articles earn <strong>3× more</strong> on average.
                Each article earns indefinitely from all future visits.
                Use our AI assistant to generate a full article in seconds.
              </p>
              <Link to="/publisher/article/new"
                style={{ ...S.btn, marginTop: 12, fontSize: 12, padding: "7px 16px", display: "inline-block" }}>
                Write with AI →
              </Link>
            </div>
          </div>
        </div>

        {/* Publisher link code */}
        <div style={S.card}>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Your Publisher Code</p>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            Paste this code in the Telegram app to link your earnings account:
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ flex: 1, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>
              {me?.link_code}
            </code>
            <button
              style={{ ...S.btn, padding: "10px 16px", fontSize: 13, flexShrink: 0 }}
              onClick={() => copy(me?.link_code || "")}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          {me?.linked_telegram_id ? (
            <p style={{ fontSize: 11, color: "#059669", marginTop: 8, fontWeight: 600 }}>
              ✓ Linked to Telegram ID: {me.linked_telegram_id}
            </p>
          ) : (
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
              Not linked yet — open the Telegram app and paste this code
            </p>
          )}
        </div>

        {/* Articles */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>My Articles</h2>
            <Link to="/publisher/article/new" style={{ ...S.btn, fontSize: 12, padding: "7px 14px" }}>
              + New Article
            </Link>
          </div>

          {articles.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "#6b7280" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✍️</div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No articles yet</p>
              <p style={{ fontSize: 13 }}>Write your first article and start earning!</p>
              <Link to="/publisher/article/new" style={{ ...S.btn, marginTop: 14, display: "inline-block" }}>
                Write First Article →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {articles.map(a => (
                <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</span>
                        <span style={S.badge(a.status)}>{a.status}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#9ca3af" }}>
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {a.visit_count.toLocaleString()} visits
                        {" · "}
                        ${Number(a.earnings).toFixed(4)} earned
                      </p>
                      {a.rejection_reason && (
                        <p style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>
                          ↳ Rejection reason: {a.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {a.status === "approved" && (
                      <a href={`/p/${a.slug}`} target="_blank" rel="noreferrer"
                        style={{ ...S.btnOutline, fontSize: 12, padding: "5px 12px" }}>
                        View ↗
                      </a>
                    )}
                    <Link to={`/publisher/article/${a.id}/edit`}
                      style={{ ...S.btnOutline, fontSize: 12, padding: "5px 12px" }}>
                      Edit
                    </Link>
                    <button onClick={() => remove(a.id)}
                      style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, marginLeft: "auto" }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payout modal */}
      {showPayout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%" }}>
            <p style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Request Payout</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
              Available: <strong>${available.toFixed(4)}</strong>
            </p>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
              Payment Method
            </label>
            <select
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14, background: "#fff" }}
              value={payoutMethod}
              onChange={e => setPayoutMethod(e.target.value)}>
              <option>USDT TRC-20</option>
              <option>USDT ERC-20</option>
              <option>Bitcoin (BTC)</option>
              <option>PayPal</option>
              <option>Bank Transfer</option>
            </select>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
              Wallet Address / Payment Details
            </label>
            <textarea
              style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 13, minHeight: 80, resize: "vertical", boxSizing: "border-box", fontFamily: "monospace", marginBottom: 14 }}
              placeholder="Enter your wallet address or payment details…"
              value={payoutDetails}
              onChange={e => setPayoutDetails(e.target.value)} />

            {payoutMsg && (
              <p style={{ fontSize: 12, color: payoutMsg.startsWith("Error") ? "#dc2626" : "#059669", marginBottom: 10 }}>
                {payoutMsg}
              </p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ ...S.btn, flex: 1, textAlign: "center", opacity: payoutBusy ? 0.7 : 1 } as React.CSSProperties}
                onClick={submitPayout} disabled={payoutBusy || !payoutDetails.trim()}>
                {payoutBusy ? "Submitting…" : "Submit Request"}
              </button>
              <button
                style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
                onClick={() => { setShowPayout(false); setPayoutMsg(""); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
