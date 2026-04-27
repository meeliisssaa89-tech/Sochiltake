import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { pubApi } from "../lib/publisherApi";

export default function LandingPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pubStatus, setPubStatus] = useState<{
    publishers_enabled: boolean;
    signup_enabled: boolean;
    site_title?: string;
  } | null>(null);

  const user_id = (params.get("user_id") || params.get("u") || "").trim();
  const token = (params.get("token") || params.get("t") || "").trim();
  const valid = !!user_id && !!token;

  useEffect(() => {
    document.title = "Articles Hub";
    if (!valid) {
      pubApi.status().then(setPubStatus).catch(() => setPubStatus(null));
    }
  }, [valid]);

  const begin = async () => {
    setErr(null);
    if (!valid) return;
    setBusy(true);
    try {
      await api.start(user_id, token);
      nav(`/read?u=${encodeURIComponent(user_id)}&t=${encodeURIComponent(token)}`);
    } catch (e: any) {
      setErr(e.message || "Could not start");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full card text-center fade-in">
        <div
          className="mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center text-white text-3xl"
          style={{ background: "var(--brand-color, #7c3aed)" }}
        >
          📚
        </div>
        <h1 className="text-2xl font-bold mb-2">{pubStatus?.site_title || "Articles Hub"}</h1>

        {valid ? (
          <>
            <p className="text-gray-600 text-sm mb-6">
              Read a few short articles, then receive your verification code.
            </p>
            {err && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                {err}
              </p>
            )}
            <button
              className="btn-brand w-full"
              onClick={begin}
              disabled={busy}
              data-testid="button-start"
            >
              {busy ? "Starting…" : "Start reading"}
            </button>
            <p className="mt-4 text-[11px] text-gray-400">
              Each visit generates a fresh, single-use code.
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-600 text-sm mb-6">
              Write articles, share them, and earn from every visit.
            </p>

            {pubStatus?.publishers_enabled ? (
              <div className="space-y-2">
                {pubStatus.signup_enabled && (
                  <Link
                    to="/publisher/signup"
                    className="btn-brand w-full block"
                    data-testid="link-signup"
                  >
                    Become a Publisher
                  </Link>
                )}
                <Link
                  to="/publisher/login"
                  className="block w-full text-sm py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                  data-testid="link-signin"
                >
                  Publisher Sign-in
                </Link>
              </div>
            ) : pubStatus === null ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                The publisher program is not active yet. Please check back later.
              </p>
            )}

            <p className="text-[11px] text-gray-400 mt-6">
              Coming from the app with a verification link?{" "}
              <span className="text-gray-500">Open the link from the app's task screen.</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
