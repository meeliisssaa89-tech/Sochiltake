import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { pubApi, ArticleSection } from "../lib/publisherApi";
import { AdSlot, injectHeadHtml } from "../components/AdSlot";

function renderRich(text: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  return esc(text)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,  "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,   "<h1>$1</h1>")
    .replace(/^> (.+)$/gm,   "<blockquote>$1</blockquote>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderParagraphs(content: string, midAd?: string) {
  const paras = String(content || "").split(/\n\s*\n/).filter(Boolean);
  const half = Math.ceil(paras.length / 2);
  return (
    <>
      {paras.slice(0, half).map((p, i) => {
        const html = renderRich(p.trim());
        if (html.startsWith("<h")) return <div key={`a${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("<blockquote")) return <div key={`a${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
        return <p key={`a${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
      {midAd && <AdSlot html={midAd} />}
      {paras.slice(half).map((p, i) => {
        const html = renderRich(p.trim());
        if (html.startsWith("<h")) return <div key={`b${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
        if (html.startsWith("<blockquote")) return <div key={`b${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
        return <p key={`b${i}`} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
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

  // Countdown ring (56px circle, circumference ~176)
  const ringR   = 22;
  const ringMax = 2 * Math.PI * ringR;
  const ringOffset = waitLeft > 0 ? ringMax * (waitLeft / waitPerPage) : 0;

  const canGoNext = !isCodeMode || canContinue;
  const canGoPrev = activePage > 0;

  return (
    <div className="min-h-screen" style={{ paddingBottom: "80px" }}>
      {/* Sticky header */}
      <header className="site-header">
        <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white" style={{ background: brand }}>⚡</div>
            <span className="font-bold text-sm">{siteName}</span>
          </div>
          {total > 1 && (
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {activePage + 1} / {total}
            </span>
          )}
        </div>
        {/* Progress bar */}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <AdSlot html={settings.ad_top_html} />

        {/* Cover image */}
        {a.cover_url && (
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={a.cover_url}
              alt={a.title}
              className="w-full object-cover max-h-72"
              style={{ borderRadius: 16 }}
            />
            <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(8,8,15,0.85))" }} />
          </div>
        )}

        {/* Title + meta */}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold leading-tight mb-2">{a.title}</h1>
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
          className={`glass p-5 md:p-7 ${slideDir === "forward" ? "slide-forward" : "slide-back"}`}
          key={activePage}
        >
          {current.image_url && current.image_url !== a.cover_url && (
            <img src={current.image_url} alt={current.title}
              className="w-full object-cover max-h-64 rounded-xl mb-4" />
          )}
          {current.title && current.title !== a.title && (
            <h2 className="text-xl md:text-2xl font-bold mb-4">{current.title}</h2>
          )}
          <div className="article-prose">
            {renderParagraphs(current.content, settings.ad_middle_html)}
          </div>
        </div>

        <AdSlot html={settings.ad_bottom_html} />

        {/* Code-mode CTA (only when on last page or showing timer) */}
        {isCodeMode && (
          <div className="glass-strong p-5 text-center space-y-4 rounded-2xl">
            {/* Countdown ring */}
            {!canContinue && !code && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative inline-flex items-center justify-center">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    {/* Track */}
                    <circle cx="28" cy="28" r={ringR} fill="none" stroke="var(--border-strong)" strokeWidth="4" />
                    {/* Progress — starts at top, goes clockwise */}
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
                <p className="text-sm" style={{ color: "var(--text-2)" }}>
                  {isLast ? "Almost there — hang tight" : `Read this page for ${waitLeft}s`}
                </p>
              </div>
            )}

            {/* Redirecting */}
            {redirecting && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand, borderTopColor: "transparent" }} />
                <p className="text-sm font-medium">Redirecting to your destination…</p>
              </div>
            )}

            {/* Error */}
            {codeErr && <p className="text-xs text-red-400">{codeErr}</p>}

            {/* Code reveal */}
            {code ? (
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
            ) : !redirecting && isLast && canContinue && (
              <div className="space-y-2">
                {!allRead && (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    Still need to read {total - pagesRead.size} more page(s) first.
                  </p>
                )}
                <button
                  onClick={onContinue}
                  disabled={codeBusy || !allRead}
                  className="btn-brand w-full text-base py-3"
                  data-testid="button-continue"
                >
                  {codeBusy ? "Processing…" : !allRead ? `Read all ${total} pages first` : linkedShortlink ? "Continue to destination →" : "Get verification code"}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Fixed bottom navigation bar ── */}
      <div className="bottom-nav">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Prev */}
          <button
            onClick={() => goPage(activePage - 1, "back")}
            disabled={!canGoPrev}
            className="btn-ghost px-4 py-2.5 shrink-0"
            style={{ opacity: canGoPrev ? 1 : 0.35 }}
          >
            ←
          </button>

          {/* Centre: step info OR timer for code mode */}
          <div className="flex-1 text-center">
            {isCodeMode && !code && !canContinue ? (
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                Wait {waitLeft}s • Page {activePage + 1}/{total}
              </span>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                {activePage + 1} / {total}
                {isCodeMode && ` · ${pagesRead.size} read`}
              </span>
            )}
          </div>

          {/* Next / Continue / Claim */}
          {isCodeMode ? (
            isLast ? (
              !code && !redirecting && (
                <button
                  onClick={onContinue}
                  disabled={!canContinue || codeBusy || !allRead}
                  className="btn-brand px-5 py-2.5 shrink-0 text-sm"
                  data-testid="button-continue"
                >
                  {codeBusy ? "…" : !allRead ? "Read all first" : !canContinue ? `${waitLeft}s` : linkedShortlink ? "Go →" : "Get Code"}
                </button>
              )
            ) : (
              <button
                onClick={() => goPage(activePage + 1, "forward")}
                disabled={!canContinue}
                className="btn-brand px-5 py-2.5 shrink-0 text-sm"
                data-testid="button-next-page"
                style={{ opacity: canContinue ? 1 : 0.45 }}
              >
                {canContinue ? "Next →" : `${waitLeft}s`}
              </button>
            )
          ) : (
            <button
              onClick={() => goPage(Math.min(total - 1, activePage + 1), "forward")}
              disabled={activePage >= total - 1}
              className="btn-brand px-5 py-2.5 shrink-0 text-sm"
              data-testid="button-next-page"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <footer className="text-center py-4 text-xs" style={{ color: "var(--text-3)" }}>
        © {new Date().getFullYear()} {siteName}
      </footer>
    </div>
  );
}
