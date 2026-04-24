import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function LandingPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Accept ?user_id= and ?token= (or short ?u and ?t)
  const user_id = (params.get("user_id") || params.get("u") || "").trim();
  const token = (params.get("token") || params.get("t") || "").trim();

  useEffect(() => {
    document.title = "Continue to article";
  }, []);

  const begin = async () => {
    setErr(null);
    if (!user_id || !token) {
      setErr("Missing access token. Please open this link from the app.");
      return;
    }
    setBusy(true);
    try {
      await api.start(user_id, token);
      nav(`/read?u=${encodeURIComponent(user_id)}&t=${encodeURIComponent(token)}`);
    } catch (e: any) {
      setErr(e.message || "Could not start");
      setBusy(false);
    }
  };

  const valid = !!user_id && !!token;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full card text-center fade-in">
        <div
          className="mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center text-white text-3xl"
          style={{ background: "var(--brand-color, #7c3aed)" }}
        >
          📚
        </div>
        <h1 className="text-2xl font-bold mb-2">Articles Hub</h1>
        <p className="text-gray-600 text-sm mb-6">
          Read a few short articles, then receive your verification code.
        </p>
        {!valid && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            This page expects a token. Open it from the app's task screen.
          </p>
        )}
        {err && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            {err}
          </p>
        )}
        <button
          className="btn-brand w-full"
          onClick={begin}
          disabled={!valid || busy}
          data-testid="button-start"
        >
          {busy ? "Starting…" : "Start reading"}
        </button>
        <p className="mt-4 text-[11px] text-gray-400">
          Each visit generates a fresh, single-use code.
        </p>
      </div>
    </div>
  );
}
