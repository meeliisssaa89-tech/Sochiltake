import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { pubApi, ArticleSection } from "../lib/publisherApi";
import { AdSlot, injectHeadHtml } from "../components/AdSlot";

/* ── Rich text renderer with full Markdown-like support ──────────────── */
function renderRich(text: string): string {
  let t = String(text || "");

  // 1. Extract images BEFORE escaping  ![alt](url)
  const imgs: string[] = [];
  t = t.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_, alt, src) => {
    const idx = imgs.length;
    const safeAlt = alt.replace(/"/g, "&quot;");
    imgs.push(`<img src="${src}" alt="${safeAlt}" class="article-img" style="border-radius:12px;max-width:100%;width:100%;height:auto;display:block;margin:1em auto;" />`);
    return `\x01IMG${idx}\x01`;
  });

  // 2. Extract links BEFORE escaping  [text](url)
  const links: string[] = [];
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, href) => {
    const idx = links.length;
    const safeLabel = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    links.push(`<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--brand);text-decoration:underline;word-break:break-all;">${safeLabel}</a>`);
    return `\x01LINK${idx}\x01`;
  });

  // 3. Escape HTML
  t = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 4. Block markdown
  t = t
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,  "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,   "<h1>$1</h1>")
    .replace(/^> (.+)$/gm,   "<blockquote>$1</blockquote>")
    .replace(/^---$/gm,      "<hr/>");

  // 5. Inline markdown
  t = t
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>");

  // 6. Restore image and link placeholders
  imgs.forEach((html, i) => { t = t.replaceAll(`\x01IMG${i}\x01`, html); });
  links.forEach((html, i) => { t = t.replaceAll(`\x01LINK${i}\x01`, html); });

  return t;
}

function renderParagraphs(content: string, midAd?: string) {
  const paras = String(content || "").split(/\n\s*\n/).filter(Boolean);
  const half = Math.ceil(paras.length / 2);
  const renderPara = (p: string, key: string) => {
    const html = renderRich(p.trim());
    if (html.startsWith("<h") || html.startsWith("<blockquote") || html.startsWith("<hr") || html.startsWith("<img"))
      return <div key={key} dangerouslySetInnerHTML={{ __html: html }} />;
    return <p key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  };
  return (
    <>
      {paras.slice(0, half).map((p, i) => renderPara(p, `a${i}`))}
      {midAd && <AdSlot html={midAd} />}
      {paras.slice(half).map((p, i) => renderPara(p, `b${i}`))}
    </>
  );
}

export default function PublicArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const userId    = params.get("u") || params.get("user_id") || "";
  const taskToken = params.get("t") || params.get("token")   || "";
  const isCodeMode = !!(userId && taskToken);

  const [data,        setData]        = useState<any>(null);
  const [err,         setErr]         = useState<string | null>(null);
  const [activePage,  setActivePage]  = useState(0);
  const [pagesRead,   setPagesRead]   = useState<Set<number>>(new Set([0]));
  const [waitLeft,    setWaitLeft]    = useState(0);
  const [waitPerPage, setWaitPerPage] = useState(8);
  const [canContinue, setCanContinue] = useState(false);
  const [code,        setCode]        = useState<string | null>(null);
  const [codeBusy,    setCodeBusy]    = useState(false);
  const [codeErr,     setCodeErr]     = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [slideDir,    setSlideDir]    = useState<"forward" | "back">("forward");
  const headInjected = useRef(false);
  const lastTickRef  = useRef<number>(0);
  const contentRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    document.title = "Loading…";
    pubApi.viewArticle(slug)
      .then((r) => {
        setData(r);
        document.title = r.article.title || "Article";
        if (!headInjected.current && r.settings?.ad_head_html) {
          injectHeadHtml(r.settings.ad_head_html);
          headInjected.current = true;
        }
        const wait = Math.max(2, Math.min(120, Number(r.settings?.wait_seconds || 8)));
        setWaitPerPage(wait);
        setWaitLeft(wait);
      })
      .catch((e) => setErr(e.message));
  }, [slug]);

  // Per-page countdown
  useEffect(() => {
    if (!isCodeMode || code || canContinue) return;
    if (waitLeft <= 0) { setCanContinue(true); return; }
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastTickRef.current < 900) return;
      lastTickRef.current = now;
      setWaitLeft((w) => {
        const next = Math.max(0, w - 1);
        if (next === 0) setCanContinue(true);
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [waitLeft, isCodeMode, code, canContinue, activePage]);

  if (err) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass max-w-sm w-full p-8 text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-sm text-red-400">{err}</p>
      </div>
    </div>
  );
  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--brand)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-3)" }}>Loading article…</p>
      </div>
    </div>
  );

  const a        = data.article;
  const settings = data.settings || {};
  const brand    = settings.brand_color || "#8b5cf6";
  const siteName = settings.site_title  || "AdPulse";
  const linkedShortlink = a.linked_shortlink_code as string | null | undefined;

  const rawSections: ArticleSection[] = Array.isArray(a.sections) && a.sections.length > 0
    ? a.sections
    : [{ title: a.title, content: a.content || "", image_url: a.cover_url || null }];

  const total   = rawSections.length;
  const isLast  = activePage === total - 1;
  const allRead = pagesRead.size >= total;

  const goPage = (i: number, dir?: "forward" | "back") => {
    setSlideDir(dir ?? (i > activePage ? "forward" : "back"));
    setActivePage(i);
    setPagesRead((prev) => new Set([...Array.from(prev), i]));
    setWaitLeft(waitPerPage);
    setCanContinue(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onContinue = () => {
    if (!isLast) { goPage(activePage + 1, "forward"); return; }
    if (isCodeMode) {
      if (linkedShortlink) {
        setRedirecting(true);
        setTimeout(() => { window.location.href = `/s/${linkedShortlink}`; }, 600);
      } else {
        claimCode();
      }
    }
  };

  const claimCode = async () => {
    if (!isCodeMode || codeBusy || code) return;
    setCodeBusy(true); setCodeErr(null);
    try {
      const r = await fetch("/api/p/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, token: taskToken, slug }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not generate code");
      setCode(j.code || null);
    } catch (e: any) {
      setCodeErr(e.message);
    } finally { setCodeBusy(false); }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const current  = rawSections[activePage] || rawSections[0];
  const progress = ((activePage + 1) / total) * 100;

  // Countdown ring
  const ringR   = 22;
  const ringMax = 2 * Math.PI * ringR;
  const ringOffset = waitLeft > 0 ? ringMax * (waitLeft / waitPerPage) : 0;

  const canGoNext = !isCodeMode || canContinue;
  const canGoPrev = activePage > 0;

  // Inline next/claim button shown at bottom of article content
  const showInlineNext = !code && !redirecting;
  const inlineNextLabel = (() => {
    if (isCodeMode && !canContinue) return `⏳ ${waitLeft}s`;
    if (!isLast) return "Next page →";
    if (!allRead) return `Read all ${total} pages first`;
    if (linkedShortlink) return "Continue to destination →";
    return "Get verification code";
  })();
  const inlineNextDisabled = isCodeMode
    ? (!canContinue || (isLast && !allRead) || codeBusy)
    : activePage >= total - 1;

  return (
    <div className="min-h-screen" style={{ paddingBottom: "80px" }}>
      {/* Sticky header */}
      <header className="site-header">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white" style={{ background: brand }}>⚡</div>
            <span className="font-bold text-sm truncate max-w-[160px]">{siteName}</span>
          </div>
          {total > 1 && (
            <span className="text-xs shrink-0" style={{ color: "var(--text-3)" }}>
              {activePage + 1} / {total}
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4" style={{ minWidth: 0 }}>
        <AdSlot html={settings.ad_top_html} />

        {/* Cover image */}
        {a.cover_url && (
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={a.cover_url}
              alt={a.title}
              className="w-full object-cover"
              style={{ maxHeight: "260px", borderRadius: 16 }}
            />
            <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(8,8,15,0.85))" }} />
          </div>
        )}

        {/* Title + meta */}
        <div style={{ minWidth: 0 }}>
          <h1 className="text-xl font-extrabold leading-tight mb-1" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>{a.title}</h1>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            {new Date(a.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            {total > 1 && ` · ${total} pages`}
          </p>
        </div>

        {/* Step dots navigation */}
        {total > 1 && (
          <div className="step-dots">
            {rawSections.map((_, i) => {
              const isActive = activePage === i;
              const isRead   = pagesRead.has(i) && !isActive;
              return (
                <button
                  key={i}
                  onClick={() => goPage(i)}
                  title={rawSections[i].title || `Page ${i + 1}`}
                  className={`step-dot ${isActive ? "active" : isRead ? "read" : "unread"}`}
                  style={{ width: isActive ? 20 : 6 }}
                />
              );
            })}
          </div>
        )}

        {/* Section content — directional slide animation */}
        <div
          ref={contentRef}
          className={`${slideDir === "forward" ? "slide-forward" : "slide-back"}`}
          key={activePage}
          style={{ minWidth: 0 }}
        >
          {/* Section card */}
          <div className="glass p-4" style={{ minWidth: 0 }}>
            {current.image_url && current.image_url !== a.cover_url && (
              <img src={current.image_url} alt={current.title || ""}
                className="w-full object-cover rounded-xl mb-4"
                style={{ maxHeight: "220px" }}
              />
            )}
            {current.title && current.title !== a.title && (
              <h2 className="text-lg font-bold mb-3" style={{ wordBreak: "break-word" }}>{current.title}</h2>
            )}
            <div className="article-prose">
              {renderParagraphs(current.content, settings.ad_middle_html)}
            </div>

            {/* ── Inline Next / Claim button at END of article content ── */}
            {showInlineNext && (
              <button
                className="article-next-btn"
                disabled={inlineNextDisabled}
                onClick={onContinue}
                data-testid="button-inline-next"
              >
                {codeBusy ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    {isCodeMode && !canContinue && !isLast && (
                      <svg width="18" height="18" viewBox="0 0 56 56" className="shrink-0">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
                        <circle cx="28" cy="28" r="22" fill="none"
                          stroke="white" strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 - (2 * Math.PI * 22) * (waitLeft / waitPerPage)}
                          strokeLinecap="round"
                          transform="rotate(-90 28 28)"
                          style={{ transition: "stroke-dashoffset 1s linear" }}
                        />
                      </svg>
                    )}
                    <span>{inlineNextLabel}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <AdSlot html={settings.ad_bottom_html} />

        {/* Code-mode CTA — shown when on last page or after claim */}
        {isCodeMode && (
          <div className="glass-strong p-5 text-center space-y-4 rounded-2xl">
            {/* Countdown ring — shown while waiting */}
            {!canContinue && !code && isLast && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative inline-flex items-center justify-center">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--border-strong)" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r={ringR} fill="none"
                      stroke={brand} strokeWidth="4"
                      strokeDasharray={ringMax}
                      strokeDashoffset={ringMax - ringOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 28 28)"
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  <span className="absolute text-base font-black tabular-nums" style={{ color: brand }}>{waitLeft}</span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-2)" }}>Almost there — hang tight</p>
              </div>
            )}

            {/* Redirecting */}
            {redirecting && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand, borderTopColor: "transparent" }} />
                <p className="text-sm font-medium">Redirecting to your destination…</p>
              </div>
            )}

            {codeErr && <p className="text-xs text-red-400">{codeErr}</p>}

            {/* Code reveal */}
            {code && (
              <div className="code-box space-y-3">
                <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>✅ Verification Code</p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-2xl font-mono font-black py-3 px-4 rounded-xl text-center select-all"
                    style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${brand}55`, color: brand }}
                    data-testid="text-final-code"
                  >
                    {code}
                  </code>
                  <button onClick={copyCode} className="btn-ghost px-3 py-3 text-sm">
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  Return to Telegram and paste this code to claim your reward.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Fixed bottom navigation bar ── */}
      <div className="bottom-nav">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => goPage(activePage - 1, "back")}
            disabled={!canGoPrev}
            className="btn-ghost px-4 py-2 shrink-0 text-sm"
            style={{ opacity: canGoPrev ? 1 : 0.3, minWidth: 56 }}
          >
            ← Prev
          </button>

          <div className="flex-1 text-center min-w-0">
            {isCodeMode && !code && !canContinue ? (
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                ⏳ {waitLeft}s · {activePage + 1}/{total}
              </span>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                {activePage + 1} / {total}
                {isCodeMode && pagesRead.size < total && ` · ${pagesRead.size} read`}
              </span>
            )}
          </div>

          {isCodeMode ? (
            isLast ? (
              !code && !redirecting && (
                <button
                  onClick={onContinue}
                  disabled={!canContinue || codeBusy || !allRead}
                  className="btn-brand px-4 py-2 shrink-0 text-sm"
                  data-testid="button-continue"
                  style={{ minWidth: 80 }}
                >
                  {codeBusy ? "…" : !allRead ? "Read all" : !canContinue ? `${waitLeft}s` : linkedShortlink ? "Go →" : "Get Code"}
                </button>
              )
            ) : (
              <button
                onClick={() => goPage(activePage + 1, "forward")}
                disabled={!canContinue}
                className="btn-brand px-4 py-2 shrink-0 text-sm"
                data-testid="button-next-page"
                style={{ opacity: canContinue ? 1 : 0.5, minWidth: 80 }}
              >
                {canContinue ? "Next →" : `${waitLeft}s`}
              </button>
            )
          ) : (
            <button
              onClick={() => goPage(Math.min(total - 1, activePage + 1), "forward")}
              disabled={activePage >= total - 1}
              className="btn-brand px-4 py-2 shrink-0 text-sm"
              data-testid="button-next-page"
              style={{ minWidth: 80 }}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <footer className="text-center py-3 text-xs" style={{ color: "var(--text-3)" }}>
        © {new Date().getFullYear()} {siteName}
      </footer>
    </div>
  );
}
