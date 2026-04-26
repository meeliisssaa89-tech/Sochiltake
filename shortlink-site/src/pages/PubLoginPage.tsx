import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, setPubToken } from "../lib/publisherApi";

export default function PubLoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [signupOn, setSignupOn] = useState(false);

  useEffect(() => {
    pubApi.status().then((s) => {
      setEnabled(s.publishers_enabled);
      setSignupOn(s.signup_enabled);
    }).catch(() => setEnabled(false));
    document.title = "Publisher Login";
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await pubApi.login(email.trim(), password);
      setPubToken(r.token);
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === null) return <CenterCard>Loading…</CenterCard>;
  if (!enabled) return <CenterCard>The publisher program is not active yet.</CenterCard>;

  return (
    <CenterCard>
      <h1 className="text-xl font-bold mb-1">Publisher Sign-in</h1>
      <p className="text-xs text-gray-500 mb-4">Manage your articles & earnings.</p>
      <form onSubmit={onSubmit} className="space-y-2">
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-pub-email" />
        <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="input-pub-password" />
        {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
        <button className="btn-brand w-full" disabled={busy} data-testid="button-pub-login">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {signupOn && (
        <p className="text-xs text-center mt-3 text-gray-500">
          New here?{" "}
          <Link to="/publisher/signup" className="text-purple-600 font-medium">Create an account</Link>
        </p>
      )}
    </CenterCard>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full card fade-in">{children}</div>
    </div>
  );
}
