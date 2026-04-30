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
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState("");
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

  // Inject <head> ads once
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

  const brand = info?.settings?.brand_color || "#7c3aed";
  const title = info?.settings?.site_title || "Short Link";

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f0f13", color: "#fff", fontFamily: "system-ui,sans-serif", gap: 12 }}>
        <p style={{ fontSize: 48 }}>🔗</p>
        <p style={{ color: "#f87171", fontSize: 18, fontWeight: 600 }}>Link not found</p>
        <p style={{ color: "#9ca3af" }}>{error}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f13" }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${brand}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#fff", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top ad */}
      <div style={{ width: "100%" }}>
        <AdHtml html={info.settings.ad_top_html} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", gap: 20 }}>
        {/* Site name */}
        <p style={{ fontSize: 13, color: "#6b7280", letterSpacing: 2, textTransform: "uppercase" }}>{title}</p>

        {/* Link icon */}
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${brand}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
          🔗
        </div>

        {/* Title / destination */}
        {info.title && (
          <p style={{ fontSize: 18, fontWeight: 700, textAlign: "center", maxWidth: 420 }}>{info.title}</p>
        )}
        <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", wordBreak: "break-all", maxWidth: 360 }}>
          {info.original_url.length > 60 ? info.original_url.slice(0, 60) + "…" : info.original_url}
        </p>

        {/* Middle ad */}
        <AdHtml html={info.settings.ad_middle_html} />

        {/* Countdown */}
        {!redirected && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", border: `4px solid ${brand}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: brand }}>
              {countdown}
            </div>
            <p style={{ fontSize: 13, color: "#9ca3af" }}>ستُحوَّل خلال {countdown} ثانية</p>
          </div>
        )}

        {/* Manual redirect */}
        <a
          href={info.original_url}
          style={{ background: brand, color: "#fff", padding: "12px 32px", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none", textAlign: "center" }}
        >
          انتقل الآن →
        </a>
      </div>

      {/* Bottom ad */}
      <div style={{ width: "100%" }}>
        <AdHtml html={info.settings.ad_bottom_html} />
      </div>
    </div>
  );
}
