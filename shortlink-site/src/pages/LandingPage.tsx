import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { pubApi } from "../lib/publisherApi";

const FEATURES = [
  { icon: "✍️", title: "Write & Earn", desc: "Publish multi-page articles and earn for every verified reader visit. The more they read, the more you make." },
  { icon: "🔗", title: "Smart Shortlinks", desc: "Shorten any URL with built-in ad display. Readers see ads before reaching the destination — you earn every click." },
  { icon: "📊", title: "Real-time Analytics", desc: "Track visits, earnings, and performance across all your content from one clean dashboard." },
  { icon: "🤖", title: "AI Writing Assistant", desc: "Generate full multi-section articles from a single topic prompt — ready to publish in seconds." },
  { icon: "⚡", title: "Instant Payouts", desc: "Submit withdrawal requests at any time. Earnings paid directly to your crypto wallet." },
  { icon: "🚀", title: "Telegram API", desc: "Coming soon — auto-publish tasks to Telegram bots via API. Zero manual work required." },
];

const STEPS = [
  { n: "01", title: "Create an Account", desc: "Sign up as a publisher in under a minute. Free to join, no credit card required." },
  { n: "02", title: "Write or Shorten", desc: "Write rich articles with our block editor, or shorten any URL to attach ads to it." },
  { n: "03", title: "Share & Earn", desc: "Share your content links anywhere. Every real visit generates revenue for you." },
];

const FAQS = [
  { q: "How do I get paid?", a: "You earn per verified visit. When your balance reaches the minimum threshold, you can submit a withdrawal request. We pay in TON or USDT to your crypto wallet — usually processed within 24 hours." },
  { q: "What is the minimum article length?", a: "Each article must have at least 3 pages (sections), and each section must contain a minimum character count set by the platform admin. This ensures a quality reading experience for every visitor." },
  { q: "How do shortlinks work?", a: "When someone clicks your shortlink, they see a brief ad interstitial before being redirected to your target URL. You earn a small amount per redirect. Shortlinks can also be attached to articles — the last page redirects readers through your shortlink, stacking earnings." },
  { q: "How is content moderated?", a: "All new articles go through an admin review before going public. Articles violating our guidelines will be rejected with a reason provided. Quality content is approved quickly, usually within a few hours." },
  { q: "What is the Telegram API integration?", a: "Coming soon — publishers will connect their Telegram bots to auto-create tasks, shortlinks, and distribute content to their audience directly via our API. One API key, full automation." },
  { q: "Can I attach a shortlink to an article?", a: "Yes! When writing an article, you can attach one of your active shortlinks. At the end of the last article page, readers are redirected through your shortlink instead of (or alongside) a task code — maximizing your earnings per visit." },
  { q: "Is there a cost to join?", a: "No. Creating a publisher account is completely free. We only earn when you earn — through the ad impressions your content generates." },
];

export default function LandingPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pubStatus, setPubStatus] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const user_id = (params.get("user_id") || params.get("u") || "").trim();
  const token   = (params.get("token")   || params.get("t") || "").trim();
  const valid   = !!user_id && !!token;

  useEffect(() => {
    document.title = "AdPulse — Publisher Platform";
    pubApi.status().then(setPubStatus).catch(() => {});
  }, []);

  const begin = async () => {
    if (!valid) return;
    setErr(null); setBusy(true);
    try {
      await api.start(user_id, token);
      nav(`/read?u=${encodeURIComponent(user_id)}&t=${encodeURIComponent(token)}`);
    } catch (e: any) {
      setErr(e.message || "Could not start");
      setBusy(false);
    }
  };

  const brand = pubStatus?.brand_color || "#8b5cf6";
  const siteName = pubStatus?.site_title || "AdPulse";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="site-header">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: brand }}>⚡</div>
            <span className="font-bold tracking-tight">{siteName}</span>
          </div>
          {!valid && pubStatus?.publishers_enabled && (
            <div className="flex items-center gap-2">
              <Link to="/publisher/login" className="btn-ghost text-sm py-2 px-4">Sign in</Link>
              {pubStatus?.signup_enabled && (
                <Link to="/publisher/signup" className="btn-brand text-sm py-2 px-4">Get Started</Link>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Task Entry (Telegram flow) */}
      {valid ? (
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
          <div className="glass-strong max-w-md w-full p-8 text-center fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5" style={{ background: `${brand}22` }}>📚</div>
            <h1 className="text-2xl font-bold mb-2">{siteName}</h1>
            <p style={{ color: "var(--text-2)" }} className="text-sm mb-7 leading-relaxed">
              Read a short article and receive your verification code to claim your reward.
            </p>
            {err && <div className="mb-4 px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">{err}</div>}
            <button className="btn-brand w-full text-base py-3" onClick={begin} disabled={busy} data-testid="button-start">
              {busy ? "Starting…" : "Start Reading →"}
            </button>
            <p className="mt-4 text-xs" style={{ color: "var(--text-3)" }}>Each visit generates a fresh, single-use code.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="relative max-w-5xl mx-auto px-5 pt-24 pb-20 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-6" style={{ borderColor: "var(--border-strong)", background: "var(--surface-2)", color: "var(--text-2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Publisher platform — now accepting applications
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              Monetize your content<br />
              <span style={{ background: `linear-gradient(135deg, ${brand}, #06b6d4)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                at every click
              </span>
            </h1>
            <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-2)" }}>
              Write articles, shorten links, and earn from every reader visit.
              Built for creators, bloggers, and digital publishers.
            </p>
            {pubStatus?.publishers_enabled ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {pubStatus?.signup_enabled && (
                  <Link to="/publisher/signup" className="btn-brand text-base px-7 py-3" data-testid="link-signup">
                    Become a Publisher
                  </Link>
                )}
                <Link to="/publisher/login" className="btn-ghost text-base px-7 py-3" data-testid="link-signin">
                  Sign in
                </Link>
              </div>
            ) : pubStatus === null ? (
              <div className="flex justify-center"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand, borderTopColor: "transparent" }} /></div>
            ) : (
              <div className="inline-block px-5 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                Publisher program not active yet — check back soon.
              </div>
            )}
          </section>

          {/* Stats */}
          <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--surface-1)" }}>
            <div className="max-w-5xl mx-auto px-5 py-6 grid grid-cols-3 gap-4 text-center">
              {[["10K+","Active Publishers"],["5M+","Monthly Reads"],["Instant","Crypto Payouts"]].map(([v,l]) => (
                <div key={l}>
                  <p className="text-2xl font-extrabold" style={{ color: brand }}>{v}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{l}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section className="max-w-5xl mx-auto px-5 py-20">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Everything you need to publish & earn</h2>
            <p className="text-center text-sm mb-12 max-w-lg mx-auto" style={{ color: "var(--text-2)" }}>
              A complete toolkit for content creators who want to turn reads and clicks into real revenue.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="glass p-5 transition-colors hover:border-white/20">
                  <div className="text-2xl mb-3">{f.icon}</div>
                  <h3 className="font-bold mb-1.5">{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <div className="max-w-4xl mx-auto px-5 py-20">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How it works</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {STEPS.map((s) => (
                  <div key={s.n} className="text-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black mx-auto mb-4" style={{ background: `${brand}22`, border: `1px solid ${brand}44`, color: brand }}>{s.n}</div>
                    <h3 className="font-bold mb-2">{s.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Telegram API banner */}
          <section className="max-w-5xl mx-auto px-5 py-20">
            <div className="glass-strong p-8 md:p-10 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `radial-gradient(ellipse at 70% 50%, ${brand}, transparent 70%)` }} />
              <div className="relative">
                <span className="badge badge-purple mb-4">Coming Soon</span>
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Telegram Bot API Integration</h2>
                <p className="max-w-2xl leading-relaxed mb-6" style={{ color: "var(--text-2)" }}>
                  Connect your Telegram bot directly to our platform. Auto-publish tasks, create shortlinks,
                  and distribute content to your audience — all via a simple REST API with a single key. No manual work. No delays.
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  {["Auto-task creation","Shortlink generation","Reader analytics","Webhook events","Bulk article publishing"].map((f) => (
                    <span key={f} className="px-3 py-1.5 rounded-lg border text-sm" style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-2)" }}>✓ {f}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)" }}>
            <div className="max-w-3xl mx-auto px-5 py-20">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Frequently Asked Questions</h2>
              <div className="space-y-2">
                {FAQS.map((faq, i) => (
                  <div key={i} className="glass overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left font-medium transition-colors hover:bg-white/5"
                    >
                      <span className="text-sm">{faq.q}</span>
                      <span className="ml-4 flex-shrink-0 text-lg font-light transition-transform" style={{ color: "var(--text-3)", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                    </button>
                    {openFaq === i && (
                      <div className="px-5 pb-4 pt-3 text-sm leading-relaxed border-t" style={{ color: "var(--text-2)", borderColor: "var(--border)" }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          {pubStatus?.publishers_enabled && pubStatus?.signup_enabled && (
            <section className="max-w-5xl mx-auto px-5 py-20 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to start earning?</h2>
              <p className="mb-8" style={{ color: "var(--text-2)" }}>Join thousands of publishers monetizing their content today.</p>
              <Link to="/publisher/signup" className="btn-brand text-base px-8 py-3">Create Free Account →</Link>
            </section>
          )}

          {/* Footer */}
          <footer style={{ borderTop: "1px solid var(--border)" }} className="py-8">
            <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded flex items-center justify-center text-xs text-white font-bold" style={{ background: brand }}>⚡</div>
                <span className="font-bold text-sm">{siteName}</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>© {new Date().getFullYear()} {siteName} — Publisher Advertising Platform</p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
