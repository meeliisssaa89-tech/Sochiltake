import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

interface LinkInfo {
  original_url: string;
  title: string | null;
  article: {
    title: string;
    content: string;
    image_url: string | null;
  } | null;
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

function renderText(text: string) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>");
}

export default function ShortlinkRedirectPage() {
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [canRedirect, setCanRedirect] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [articleRead, setArticleRead] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headInjected = useRef(false);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/ls/info?code=${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setInfo(d);
        const delay = Math.max(5, Math.min(60, d.settings?.redirect_delay ?? 10));
        setCountdown(delay);
      })
      .catch(() => setError("Failed to load link info."));
  }, [code]);

  // Inject <head> ads
  useEffect(() => {
    if (!info?.settings?.ad_head_html || headInjected.current) return;
    headInjected.current = true;
    const div = document.createElement("div");
    div.innerHTML = info.settings.ad_head_html;
    div.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      document.head.appendChild(s);
    });
    div.querySelectorAll("link, style").forEach(n => document.head.appendChild(n.cloneNode(true)));
  }, [info?.settings?.ad_head_html]);

  // Countdown after info loaded
  useEffect(() => {
    if (!info || canRedirect) return;
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setCanRedirect(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [info, canRedirect]);

  // Set article as "read" once countdown is done
  useEffect(() => {
    if (canRedirect) setArticleRead(true);
  }, [canRedirect]);

  const doRedirect = () => {
    if (!info || !canRedirect) return;
    setRedirecting(true);
    window.location.href = info.original_url;
  };

  const brand = info?.settings?.brand_color || "#7c3aed";
  const siteTitle = info?.settings?.site_title || "Articles Hub";

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", fontFamily: "system-ui,sans-serif", gap: 12, padding: 24 }}>
        <div style={{ fontSize: 48 }}>🔗</div>
        <p style={{ color: "#ef4444", fontSize: 18, fontWeight: 700 }}>Link not found</p>
        <p style={{ color: "#6b7280", fontSize: 14, textAlign: "center" }}>{error}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${brand}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const article = info.article;
  const paragraphs = article
    ? String(article.content || "").split(/\n\s*\n/).filter(p => p.trim().length > 0)
    : [];
  const half = Math.ceil(paragraphs.length / 2);

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8fc", fontFamily: "system-ui,sans-serif", color: "#111" }}>

      {/* Top ad */}
      <AdHtml html={info.settings.ad_top_html} />

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: brand }}>{siteTitle}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!canRedirect ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2.5px solid ${brand}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: brand }}>
                {countdown}
              </div>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Read the article to continue</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ Ready to visit</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>

        {/* Destination banner */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: `${brand}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            🔗
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {info.title && <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{info.title}</p>}
            <p style={{ fontSize: 12, color: "#6b7280", wordBreak: "break-all" }}>
              {info.original_url.length > 70 ? info.original_url.slice(0, 70) + "…" : info.original_url}
            </p>
          </div>
          {canRedirect && (
            <button
              style={{ background: brand, color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer", flexShrink: 0, opacity: redirecting ? 0.7 : 1 }}
              onClick={doRedirect} disabled={redirecting}>
              {redirecting ? "Opening…" : "Visit Link →"}
            </button>
          )}
        </div>

        {/* Article content */}
        {article ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
            {article.image_url && (
              <img src={article.image_url} alt={article.title}
                style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
            )}
            <div style={{ padding: "24px 24px 20px" }}>
              <h1 style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
                {article.title}
              </h1>

              <AdHtml html={info.settings.ad_top_html} />

              <div style={{ lineHeight: 1.8, fontSize: 15, color: "#374151" }}>
                {paragraphs.slice(0, half).map((p, i) => (
                  <p key={`a${i}`} style={{ marginBottom: 16 }}
                    dangerouslySetInnerHTML={{ __html: renderText(p) }} />
                ))}

                {info.settings.ad_middle_html && (
                  <div style={{ margin: "20px 0" }}>
                    <AdHtml html={info.settings.ad_middle_html} />
                  </div>
                )}

                {paragraphs.slice(half).map((p, i) => (
                  <p key={`b${i}`} style={{ marginBottom: 16 }}
                    dangerouslySetInnerHTML={{ __html: renderText(p) }} />
                ))}
              </div>

              {/* Call to action at end of article */}
              <div style={{ marginTop: 28, padding: "20px 22px", background: canRedirect ? `${brand}08` : "#f9fafb", border: `1.5px solid ${canRedirect ? brand : "#e5e7eb"}`, borderRadius: 14, textAlign: "center" }}>
                {canRedirect ? (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#111" }}>
                      ✅ Article read — your link is ready!
                    </p>
                    <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                      Click below to visit your destination:
                    </p>
                    <p style={{ fontSize: 12, color: "#6b7280", wordBreak: "break-all", marginBottom: 16 }}>
                      {info.original_url}
                    </p>
                    <button
                      style={{ background: brand, color: "#fff", border: "none", borderRadius: 12, padding: "13px 36px", fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 14px ${brand}44`, opacity: redirecting ? 0.7 : 1 }}
                      onClick={doRedirect} disabled={redirecting}>
                      {redirecting ? "Opening…" : "Visit Destination →"}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", border: `4px solid ${brand}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: brand, margin: "0 auto 10px" }}>
                      {countdown}
                    </div>
                    <p style={{ fontSize: 13, color: "#6b7280" }}>
                      Reading timer — your link will unlock in <strong>{countdown}</strong> second{countdown !== 1 ? "s" : ""}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* No article — pure countdown */
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
            {canRedirect ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Your link is ready</p>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, wordBreak: "break-all" }}>
                  {info.original_url}
                </p>
                <button
                  style={{ background: brand, color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: redirecting ? 0.7 : 1 }}
                  onClick={doRedirect} disabled={redirecting}>
                  {redirecting ? "Opening…" : "Visit Link →"}
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 72, height: 72, borderRadius: "50%", border: `5px solid ${brand}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: brand, margin: "0 auto 12px" }}>
                  {countdown}
                </div>
                <p style={{ fontSize: 14, color: "#6b7280" }}>Preparing your link…</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom ad */}
      <AdHtml html={info.settings.ad_bottom_html} />

      <div style={{ textAlign: "center", padding: "20px 16px", fontSize: 11, color: "#9ca3af" }}>
        © {new Date().getFullYear()} {siteTitle}
      </div>
    </div>
  );
}
