import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, setPubToken } from "../lib/publisherApi";

export default function PubLoginPage() {
  const nav = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [enabled, setEnabled]   = useState<boolean | null>(null);
  const [signupOn, setSignupOn] = useState(false);
  const [siteName, setSiteName] = useState("AdPulse");

  useEffect(() => {
    pubApi.status().then((s) => {
      setEnabled(s.publishers_enabled);
      setSignupOn(s.signup_enabled);
      setSiteName(s.site_title || "AdPulse");
    }).catch(() => setEnabled(false));
    document.title = "Publisher Sign-in";
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await pubApi.login(email.trim(), password);
      setPubToken(r.token);
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  if (enabled === null) return <Loader />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand)] flex items-center justify-center text-xl mx-auto mb-3 shadow-lg" style={{ boxShadow: "0 8px 32px var(--brand-glow)" }}>⚡</div>
          <h1 className="text-xl font-extrabold">{siteName}</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>Publisher workspace</p>
        </div>

        {!enabled ? (
          <div className="glass p-6 text-center">
            <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>The publisher program is not active yet.</p>
            <Link to="/" className="btn-ghost text-sm">← Back to home</Link>
          </div>
        ) : (
          <div className="glass-strong p-7 space-y-4">
            <div>
              <h2 className="font-bold text-lg">Welcome back</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>Sign in to manage your content & earnings.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                  data-testid="input-pub-email" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  data-testid="input-pub-password" />
              </div>
              {err && <div className="px-4 py-3 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20">{err}</div>}
              <button className="btn-brand w-full py-3" disabled={busy} data-testid="button-pub-login">
                {busy ? "Signing in…" : "Sign in →"}
              </button>
            </form>

            {signupOn && (
              <p className="text-center text-xs" style={{ color: "var(--text-3)" }}>
                New here?{" "}
                <Link to="/publisher/signup" className="font-semibold" style={{ color: "var(--brand)" }}>Create an account</Link>
              </p>
            )}
          </div>
        )}

        <p className="text-center mt-6 text-xs" style={{ color: "var(--text-3)" }}>
          <Link to="/" style={{ color: "var(--text-3)" }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
    </div>
  );
}
