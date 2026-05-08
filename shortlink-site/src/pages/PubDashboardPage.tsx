import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, clearPubToken, hasPubToken, Publisher, PubArticle } from "../lib/publisherApi";

export default function PubDashboardPage() {
  const nav = useNavigate();
  const [me, setMe]             = useState<Publisher | null>(null);
  const [articles, setArticles] = useState<PubArticle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [activeTab, setActiveTab] = useState<"articles"|"api"|"faq">("articles");

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
        clearPubToken(); nav("/publisher/login");
      }
    } finally { setLoading(false); }
  };

  const onLogout = async () => {
    try { await pubApi.logout(); } catch { /* ignore */ }
    clearPubToken(); nav("/publisher/login");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this article permanently?")) return;
    await pubApi.deleteArticle(id);
    refresh();
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
    </div>
  );

  const pendingBalance  = Number(me?.pending_balance || 0);
  const lifetimeEarnings = Number(me?.lifetime_earnings || 0);
  const totalVisits      = Number(me?.total_visits || 0);
  const approvedCount    = articles.filter(a => a.status === "approved").length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="site-header">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--brand)" }}>⚡</div>
            <span className="font-bold tracking-tight">Publisher Dashboard</span>
          </div>
          <button onClick={onLogout} className="btn-ghost text-xs py-1.5 px-3">Sign out</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {err && <div className="px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">{err}</div>}

        {/* Profile card */}
        <div className="glass-strong p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: "var(--brand)", color: "#fff" }}>
                  {(me?.display_name || me?.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold leading-tight">{me?.display_name || me?.email}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>{me?.email}</p>
                </div>
              </div>
              {me?.linked_telegram_id ? (
                <span className="badge badge-green text-xs mt-1">✓ Telegram Linked</span>
              ) : (
                <span className="badge badge-yellow text-xs mt-1">Telegram not linked</span>
              )}
            </div>
            <div className="flex gap-3">
              <Link to="/publisher/article/new" className="btn-brand text-sm py-2 px-4">+ New Article</Link>
              <Link to="/publisher/shortlinks" className="btn-ghost text-sm py-2 px-4">🔗 Shortlinks</Link>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: "Pending Balance", value: pendingBalance.toFixed(4), icon: "💰", accent: true },
              { label: "Lifetime Earned", value: lifetimeEarnings.toFixed(4), icon: "📈" },
              { label: "Total Visits",    value: totalVisits.toLocaleString(), icon: "👁️" },
              { label: "Live Articles",   value: String(approvedCount),         icon: "✅" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: s.accent ? "rgba(139,92,246,0.1)" : "rgba(0,0,0,0.2)", border: `1px solid ${s.accent ? "rgba(139,92,246,0.25)" : "var(--border)"}` }}>
                <p className="text-lg mb-1">{s.icon}</p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>{s.label}</p>
                <p className="font-bold tabular-nums mt-0.5" style={{ color: s.accent ? "var(--brand)" : "var(--text-1)" }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Link code */}
          <div className="mt-5 p-4 rounded-xl" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--brand)" }}>Your Earning Link Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--text-1)" }} data-testid="text-link-code">
                {me?.link_code}
              </code>
              <button onClick={() => copy(me?.link_code || "")} className="btn-ghost text-xs py-2 px-3">
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            {!me?.linked_telegram_id && (
              <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>Not linked yet — open the Telegram app and paste this code to link your account.</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          {(["articles","api","faq"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{ background: activeTab === t ? "var(--brand)" : "transparent", color: activeTab === t ? "#fff" : "var(--text-2)" }}>
              {t === "articles" ? "📝 My Articles" : t === "api" ? "🚀 API & Integrations" : "❓ FAQ"}
            </button>
          ))}
        </div>

        {/* Articles tab */}
        {activeTab === "articles" && (
          <div className="space-y-3">
            {articles.length === 0 ? (
              <div className="glass p-10 text-center">
                <p className="text-4xl mb-3">✍️</p>
                <p className="font-semibold mb-1">No articles yet</p>
                <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>Write your first article and start earning from every visit.</p>
                <Link to="/publisher/article/new" className="btn-brand text-sm" data-testid="button-new-article">Write your first article</Link>
              </div>
            ) : (
              articles.map((a) => (
                <div key={a.id} className="glass p-4" data-testid={`article-${a.id}`}>
                  <div className="flex items-start gap-3">
                    {a.cover_url && (
                      <img src={a.cover_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" onError={(e) => { (e.currentTarget as any).style.display="none"; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm leading-tight truncate">{a.title}</h3>
                        <StatusBadge s={a.status} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}{a.visit_count.toLocaleString()} visits
                        {" · "}{Number(a.earnings).toFixed(4)} earned
                        {a.linked_shortlink_code && " · 🔗 Shortlink attached"}
                      </p>
                      {a.rejection_reason && (
                        <p className="text-xs text-red-400 mt-1">Rejected: {a.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    {a.status === "approved" && (
                      <a href={`/p/${a.slug}`} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: "var(--brand)" }}>View ↗</a>
                    )}
                    <Link to={`/publisher/article/${a.id}/edit`} className="text-xs font-medium" style={{ color: "var(--text-2)" }}>Edit</Link>
                    <button onClick={() => remove(a.id)} className="text-xs font-medium ml-auto" style={{ color: "var(--danger)" }}>Delete</button>
                  </div>
                </div>
              ))
            )}
            {articles.length > 0 && (
              <Link to="/publisher/article/new" className="btn-brand w-full text-center py-3 text-sm" data-testid="button-new-article">+ Write New Article</Link>
            )}
          </div>
        )}

        {/* API & Integrations tab */}
        {activeTab === "api" && (
          <div className="space-y-4">
            <div className="glass-strong p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: "radial-gradient(ellipse at 70% 30%, var(--brand), transparent 70%)" }} />
              <div className="relative">
                <span className="badge badge-purple mb-3">Coming Soon</span>
                <h2 className="text-xl font-bold mb-2">Telegram Bot API Integration</h2>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--text-2)" }}>
                  We're building a full publisher API that lets you connect your Telegram bots directly to this platform.
                  Create tasks, generate shortlinks, and distribute articles — all programmatically.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: "🤖", title: "Bot Task Creation", desc: "Auto-create article-reading tasks in your Telegram bot via API call." },
                    { icon: "🔗", title: "Shortlink API", desc: "Generate and manage shortlinks programmatically from any platform." },
                    { icon: "📊", title: "Analytics Webhooks", desc: "Receive real-time events when readers visit or complete articles." },
                    { icon: "💳", title: "Instant Payout API", desc: "Request payouts automatically when your balance threshold is met." },
                  ].map((f) => (
                    <div key={f.title} className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)" }}>
                      <p className="text-xl mb-2">{f.icon}</p>
                      <p className="font-semibold text-sm mb-1">{f.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-2)" }}>{f.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 p-4 rounded-xl" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--brand)" }}>🔔 Get notified when it launches</p>
                  <p className="text-xs" style={{ color: "var(--text-2)" }}>The API will be available to approved publishers first. Make sure your Telegram account is linked to be in the first wave.</p>
                </div>
              </div>
            </div>

            {/* Ad Platform info */}
            <div className="glass p-6">
              <h3 className="font-bold mb-3">Advertising Platform</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-2)" }}>
                Our platform works with major ad networks. Ads are displayed to readers before and during article consumption, and during shortlink redirects.
              </p>
              <div className="space-y-2">
                {[
                  { k: "Revenue model", v: "CPV — Cost Per Verified Visit" },
                  { k: "Ad formats", v: "Pre-article, mid-article, shortlink interstitial" },
                  { k: "Payout currencies", v: "TON, USDT" },
                  { k: "Minimum payout", v: "As set by platform admin" },
                ].map(({ k, v }) => (
                  <div key={k} className="flex justify-between text-sm py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-3)" }}>{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FAQ tab */}
        {activeTab === "faq" && (
          <div className="space-y-2">
            {[
              { q: "When do I get paid?", a: "Submit a withdrawal request from this dashboard once your pending balance is sufficient. Payouts are processed to your crypto wallet, typically within 24 hours of approval." },
              { q: "Why is my article still pending?", a: "All new articles go through an admin review. This usually takes a few hours. Rejection reasons are always provided so you can edit and resubmit." },
              { q: "What is the minimum article length?", a: "Each article needs at least 3 pages (sections). Each section has a minimum character count. Your editor shows you exactly how many characters you need and tracks your progress." },
              { q: "How do I attach a shortlink to an article?", a: "When writing or editing an article, select one of your active shortlinks from the 'Attached Shortlink' dropdown. When readers reach the last page, they'll be redirected through your shortlink instead of receiving just a task code." },
              { q: "How does the Telegram integration work?", a: "Link your Telegram account by copying your Link Code and pasting it into the Telegram bot. Once linked, your earnings from article reads and shortlinks will be credited to your Telegram account balance." },
              { q: "Can I edit a published article?", a: "Yes, but edited articles go back into pending review. Approved articles that are currently live will remain accessible while under re-review." },
              { q: "What types of content are allowed?", a: "Educational, informational, or entertainment content. No adult content, spam, misinformation, or content that violates our terms. High-quality, original writing gets approved fastest." },
            ].map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-white/5">
        <span>{q}</span>
        <span className="ml-4 flex-shrink-0 text-lg font-light transition-transform" style={{ color: "var(--text-3)", transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 text-sm leading-relaxed" style={{ borderTop: "1px solid var(--border)", color: "var(--text-2)" }}>
          {a}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ s }: { s: PubArticle["status"] }) {
  if (s === "approved") return <span className="badge badge-green">Live</span>;
  if (s === "pending")  return <span className="badge badge-yellow">Review</span>;
  return <span className="badge badge-red">Rejected</span>;
}
