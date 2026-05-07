import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { pubApi } from "../lib/publisherApi";

const FEATURES = [
  { icon: "✍️", title: "Write & Earn", desc: "Publish articles on any topic and earn revenue from every reader visit worldwide." },
  { icon: "🔗", title: "Link Shortener", desc: "Shorten any URL and monetize every click with our built-in ad platform." },
  { icon: "💰", title: "Real Earnings", desc: "Transparent CPA-based payments. Withdraw once you hit the minimum threshold." },
  { icon: "📊", title: "Full Analytics", desc: "Track visits, earnings by country, and article performance in real time." },
  { icon: "🤖", title: "AI Writing Assistant", desc: "Generate fully-structured, high-quality articles with one click using AI." },
  { icon: "🌍", title: "Global Reach", desc: "Every country that visits earns revenue. Higher rates for Tier-1 traffic." },
];

const STEPS = [
  { n: "01", title: "Create your account", desc: "Sign up as a publisher in seconds — no credit card required." },
  { n: "02", title: "Write or shorten", desc: "Publish articles or paste any URL to create a monetized shortlink." },
  { n: "03", title: "Share & earn", desc: "Share your content anywhere. Get paid for every real visit." },
];

export default function LandingPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pubStatus, setPubStatus] = useState<{
    publishers_enabled: boolean;
    signup_enabled: boolean;
    site_title?: string;
    brand_color?: string;
  } | null>(null);

  const user_id = (params.get("user_id") || params.get("u") || "").trim();
  const token = (params.get("token") || params.get("t") || "").trim();
  const isTask = !!user_id && !!token;

  useEffect(() => {
    document.title = pubStatus?.site_title || "Articles Hub";
    pubApi.status().then(setPubStatus).catch(() => setPubStatus(null));
  }, []);

  const brand = pubStatus?.brand_color || "#7c3aed";

  const begin = async () => {
    setErr(null);
    if (!isTask) return;
    setBusy(true);
    try {
      await api.start(user_id, token);
      nav(`/read?u=${encodeURIComponent(user_id)}&t=${encodeURIComponent(token)}`);
    } catch (e: any) {
      setErr(e.message || "Could not start");
      setBusy(false);
    }
  };

  // ── Task mode (opened from Telegram app) ──────────────────────────────────
  if (isTask) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f8fc", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", padding: 32, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 4px 24px #0001" }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: `${brand}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px" }}>
            📚
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            {pubStatus?.site_title || "Articles Hub"}
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Read a few short articles to receive your verification code and claim your reward.
          </p>
          {err && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
              {err}
            </div>
          )}
          <button
            style={{ background: brand, color: "#fff", border: "none", borderRadius: 12, padding: "13px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%", opacity: busy ? 0.7 : 1 }}
            onClick={begin}
            disabled={busy}
          >
            {busy ? "Starting…" : "Start Reading →"}
          </button>
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 14 }}>
            Each session generates a fresh, one-time verification code.
          </p>
        </div>
      </div>
    );
  }

  // ── Publisher / landing mode ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", fontFamily: "system-ui,sans-serif", background: "#fff", color: "#111" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #f0f0f0", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: brand }}>
          {pubStatus?.site_title || "Articles Hub"}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {pubStatus?.signup_enabled && pubStatus?.publishers_enabled && (
            <Link to="/publisher/signup" style={{ background: brand, color: "#fff", borderRadius: 10, padding: "8px 18px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Get Started →
            </Link>
          )}
          {pubStatus?.publishers_enabled && (
            <Link to="/publisher/login" style={{ color: "#6b7280", borderRadius: 10, padding: "8px 18px", fontWeight: 600, fontSize: 13, textDecoration: "none", border: "1px solid #e5e7eb" }}>
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: "80px 24px 60px", textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${brand}15`, color: brand, borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 700, marginBottom: 20 }}>
          ✦ Publisher Program Open
        </div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>
          Write content.<br />
          <span style={{ color: brand }}>Get paid</span> for every visit.
        </h1>
        <p style={{ fontSize: 18, color: "#6b7280", lineHeight: 1.7, marginBottom: 36, maxWidth: 540, margin: "0 auto 36px" }}>
          Publish articles or shorten URLs and earn real money from global traffic — powered by our ad platform.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {pubStatus?.signup_enabled && pubStatus?.publishers_enabled ? (
            <>
              <Link to="/publisher/signup"
                style={{ background: brand, color: "#fff", borderRadius: 12, padding: "14px 28px", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: `0 4px 14px ${brand}44` }}>
                Start Earning Free →
              </Link>
              <Link to="/publisher/login"
                style={{ border: "1.5px solid #e5e7eb", color: "#374151", borderRadius: 12, padding: "14px 28px", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                Sign In
              </Link>
            </>
          ) : pubStatus === null ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</p>
          ) : (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 20px", fontSize: 13, color: "#92400e" }}>
              Publisher program is currently closed. Check back soon.
            </div>
          )}
        </div>

        {/* Trust indicators */}
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 40, flexWrap: "wrap" }}>
          {["✓ No credit card required", "✓ Instant setup", "✓ Daily payouts available"].map(t => (
            <span key={t} style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "#f8f8fc", padding: "60px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: brand, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            How It Works
          </p>
          <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, marginBottom: 40 }}>
            Start earning in 3 steps
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 24 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: `${brand}30`, marginBottom: 8 }}>{s.n}</div>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{s.title}</p>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "60px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: brand, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            Everything You Need
          </p>
          <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, marginBottom: 40 }}>
            Built for publishers
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ borderRadius: 14, padding: 22, border: "1px solid #e5e7eb", background: "#fff" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</p>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {pubStatus?.signup_enabled && pubStatus?.publishers_enabled && (
        <div style={{ background: brand, padding: "60px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginBottom: 14 }}>
            Ready to start earning?
          </h2>
          <p style={{ fontSize: 15, color: "#ffffff99", marginBottom: 28 }}>
            Join hundreds of publishers earning from their content every day.
          </p>
          <Link to="/publisher/signup"
            style={{ background: "#fff", color: brand, borderRadius: 12, padding: "14px 32px", fontWeight: 800, fontSize: 15, textDecoration: "none", display: "inline-block" }}>
            Create Free Account →
          </Link>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "30px 24px", borderTop: "1px solid #f0f0f0", fontSize: 12, color: "#9ca3af" }}>
        © {new Date().getFullYear()} {pubStatus?.site_title || "Articles Hub"}
        {pubStatus?.publishers_enabled && (
          <span>
            {" · "}
            <Link to="/publisher/login" style={{ color: "#9ca3af", textDecoration: "none" }}>Publisher Login</Link>
            {" · "}
            <a href="/admin" style={{ color: "#9ca3af", textDecoration: "none" }}>Admin</a>
          </span>
        )}
      </div>
    </div>
  );
}
