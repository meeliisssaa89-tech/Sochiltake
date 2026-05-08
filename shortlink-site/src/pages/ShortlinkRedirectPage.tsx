import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

interface LinkInfo {
  original_url: string;
  title: string | null;
  settings: {
    site_title: string;
    brand_color: string;
    ad_head_html: string;
    ad_top_html: string;
    ad_middle_html: string;
    ad_bottom_html: string;
    redirect_delay: number;
  };
}

function AdHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!html || !ref.current) return;
    ref.current.innerHTML = html;
    ref.current.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }, [html]);
  if (!html) return null;
  return <div ref={ref} />;
}

export default function ShortlinkRedirectPage() {
  const { code } = useParams<{ code: string }>();
  const [info, setInfo]           = useState<LinkInfo | null>(null);
  const [error, setError]         = useState("");
  const [countdown, setCountdown] = useState(10);
  const [redirected, setRedirected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/ls/info?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setInfo(d);
        const delay = Math.max(3, Math.min(60, d.settings?.redirect_delay ?? 10));
        setCountdown(delay);
      })
      .catch(() => setError("Failed to load link info."));
  }, [code]);

  // Inject head ads once
  useEffect(() => {
    if (!info?.settings?.ad_head_html) return;
    const div = document.createElement("div");
    div.innerHTML = info.settings.ad_head_html;
    div.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      document.head.appendChild(s);
    });
    div.querySelectorAll("link, style").forEach((n) => document.head.appendChild(n.cloneNode(true)));
  }, [info?.settings?.ad_head_html]);

  // Countdown
  useEffect(() => {
    if (!info || redirected) return;
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setRedirected(true);
          window.location.href = info!.original_url;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [info, redirected]);

  const brand    = info?.settings?.brand_color || "#8b5cf6";
  const siteName = info?.settings?.site_title  || "AdPulse";
  const total    = info ? Math.max(3, Math.min(60, info.settings.redirect_delay ?? 10)) : 10;
  const ringR    = 28;
  const ringC    = 2 * Math.PI * ringR; // ~176
  const ringOff  = ringC * (countdown / total);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="glass max-w-sm w-full p-8 fade-in">
          <p className="text-5xl mb-4">🔗</p>
          <p className="font-bold text-red-400 mb-2">Link not found</p>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand, borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top ad */}
      <AdHtml html={info.settings.ad_top_html} />

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-6 text-center">
        {/* Site brand */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: brand }}>⚡</div>
          <span className="text-sm font-bold" style={{ color: "var(--text-2)" }}>{siteName}</span>
        </div>

        {/* Link card */}
        <div className="glass-strong w-full max-w-md p-7 space-y-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto" style={{ background: `${brand}22`, border: `1px solid ${brand}44` }}>🔗</div>

          {info.title && (
            <h1 className="text-xl font-bold leading-tight">{info.title}</h1>
          )}

          <p className="text-xs break-all px-2" style={{ color: "var(--text-3)" }}>
            {info.original_url.length > 65 ? info.original_url.slice(0, 65) + "…" : info.original_url}
          </p>

          {/* Middle ad */}
          <AdHtml html={info.settings.ad_middle_html} />

          {/* Countdown ring */}
          {!redirected ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <svg width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r={ringR} fill="none" stroke="var(--border)" strokeWidth="5" />
                  <circle cx="36" cy="36" r={ringR} fill="none" stroke={brand} strokeWidth="5"
                    strokeDasharray={ringC} strokeDashoffset={ringC - ringOff}
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-black" style={{ color: brand }}>{countdown}</span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-2)" }}>Redirecting in {countdown}s</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand, borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "var(--text-2)" }}>Redirecting…</p>
            </div>
          )}

          {/* Manual redirect */}
          <a href={info.original_url}
            className="btn-brand w-full py-3 text-center block"
            style={{ textDecoration: "none" }}>
            Go now →
          </a>

          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            You'll be automatically redirected. This shortlink is powered by {siteName}.
          </p>
        </div>
      </div>

      {/* Bottom ad */}
      <AdHtml html={info.settings.ad_bottom_html} />
    </div>
  );
}
