import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, setPubToken } from "../lib/publisherApi";

export default function PubSignupPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    pubApi.status().then((s) => setAllowed(s.publishers_enabled && s.signup_enabled)).catch(() => setAllowed(false));
    document.title = "Publisher Sign-up";
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await pubApi.signup(email.trim(), password, name.trim() || undefined);
      setPubToken(r.token);
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full card text-center">
          <p className="text-sm">Sign-up is currently closed.</p>
          <Link to="/publisher/login" className="text-purple-600 text-xs mt-2 inline-block">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full card fade-in">
        <h1 className="text-xl font-bold mb-1">Become a Publisher</h1>
        <p className="text-xs text-gray-500 mb-4">Write articles, earn from every visit.</p>
        <form onSubmit={onSubmit} className="space-y-2">
          <input className="input" placeholder="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-signup-email" />
          <input className="input" type="password" placeholder="Password (6+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} data-testid="input-signup-password" />
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <button className="btn-brand w-full" disabled={busy} data-testid="button-signup">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-xs text-center mt-3 text-gray-500">
          Already a publisher?{" "}
          <Link to="/publisher/login" className="text-purple-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
