import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, setPubToken } from "../lib/publisherApi";

export default function PubSignupPage() {
  const nav = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [allowed, setAllowed]   = useState<boolean | null>(null);
  const [siteName, setSiteName] = useState("AdPulse");

  useEffect(() => {
    pubApi.status().then((s) => {
      setAllowed(s.publishers_enabled && s.signup_enabled);
      setSiteName(s.site_title || "AdPulse");
    }).catch(() => setAllowed(false));
    document.title = "Become a Publisher";
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await pubApi.signup(email.trim(), password, name.trim() || undefined);
      setPubToken(r.token);
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass max-w-sm w-full p-8 text-center fade-in">
          <p className="text-3xl mb-3">🔒</p>
          <p className="font-semibold mb-1">Sign-up is currently closed</p>
          <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>The publisher program is not accepting new applications right now. Check back soon.</p>
          <Link to="/publisher/login" className="btn-ghost text-sm">Sign in instead</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand)] flex items-center justify-center text-xl mx-auto mb-3 shadow-lg" style={{ boxShadow: "0 8px 32px var(--brand-glow)" }}>⚡</div>
          <h1 className="text-xl font-extrabold">{siteName}</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Publisher program</p>
        </div>

        <div className="glass-strong p-7 space-y-4">
          <div>
            <h2 className="font-bold text-lg">Become a Publisher</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Write articles, shorten links, and earn from every visit.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="label">Display Name <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(optional)</span></label>
              <input className="input" placeholder="Your author name"
                value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="input-signup-email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="6+ characters"
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                data-testid="input-signup-password" />
            </div>
            {err && <div className="px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">{err}</div>}
            <button className="btn-brand w-full py-3" disabled={busy} data-testid="button-signup">
              {busy ? "Creating account…" : "Create Free Account →"}
            </button>
          </form>

          <p className="text-center text-xs" style={{ color: "var(--text-3)" }}>
            Already a publisher?{" "}
            <Link to="/publisher/login" className="font-semibold" style={{ color: "var(--brand)" }}>Sign in</Link>
          </p>
        </div>

        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-3)" }}>
          <Link to="/" style={{ color: "var(--text-3)" }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
