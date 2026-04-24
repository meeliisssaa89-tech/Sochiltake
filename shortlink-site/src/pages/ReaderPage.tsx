import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api, Article, SiteSettings } from "../lib/api";
import { AdSlot, injectHeadHtml } from "../components/AdSlot";

export default function ReaderPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const user_id = (params.get("u") || params.get("user_id") || "").trim();
  const token = (params.get("t") || params.get("token") || "").trim();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(0); // 0-based, current article shown
  const [article, setArticle] = useState<Article | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(8);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalCode, setFinalCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user_id || !token) {
        nav("/");
        return;
      }
      try {
        const s = await api.start(user_id, token);
        if (cancelled) return;
        setSessionId(s.session_id);
        setPageCount(s.page_count);
        setWaitSeconds(s.wait_seconds);
        setSettings(s.settings);
        setArticle(s.article);
        setPageIndex(0);
        setRemaining(s.wait_seconds);
        if (s.completed && s.code) {
          setFinalCode(s.code);
          setPageIndex(s.page_count);
        }
        // Brand color
        if (s.settings?.brand_color) {
          document.documentElement.style.setProperty("--brand-color", s.settings.brand_color);
        }
        if (s.settings?.site_title) document.title = s.settings.site_title;
        injectHeadHtml(s.settings?.ad_head_html);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown
  useEffect(() => {
    if (finalCode) return;
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [pageIndex, finalCode]);

  const isLastPage = pageIndex >= pageCount - 1;
  const progress = useMemo(
    () => (pageCount === 0 ? 0 : Math.round(((pageIndex + (finalCode ? 1 : 0)) / pageCount) * 100)),
    [pageIndex, pageCount, finalCode]
  );

  const onContinue = async () => {
    if (!sessionId || advancing || remaining > 0) return;
    setAdvancing(true);
    setError(null);
    try {
      const next = pageIndex + 1;
      const r = await api.page(sessionId, next);
      setArticle(r.article);
      setPageIndex(r.completed ? pageCount : next);
      setWaitSeconds(r.wait_seconds);
      setRemaining(r.wait_seconds);
      if (r.completed && r.code) setFinalCode(r.code);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e.message || "Could not load next page");
      // If server told us a wait_remaining, show it
      const m = (e.message || "").match(/(\d+)s/);
      if (m) setRemaining(Number(m[1]));
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (error && !article && !finalCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full card text-center">
          <h2 className="text-lg font-semibold mb-2">Can't open this link</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button className="btn-brand" onClick={() => nav("/")}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Sticky header with progress */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">{settings?.site_title || "Articles Hub"}</span>
            <span className="text-xs text-gray-500" data-testid="text-progress">
              {finalCode ? "Complete" : `Page ${pageIndex + 1} / ${pageCount}`}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "var(--brand-color)" }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        <AdSlot html={settings?.ad_top_html} className="mb-4" />

        {finalCode ? (
          <CodeReveal code={finalCode} copied={copied} setCopied={setCopied} />
        ) : article ? (
          <article className="card fade-in" key={pageIndex}>
            {article.image_url && (
              <img
                src={article.image_url}
                alt=""
                className="w-full h-56 object-cover rounded-xl mb-4"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
            <h1 className="text-2xl font-bold mb-3">{article.title}</h1>

            {/* Split content into paragraphs and inject middle ad */}
            <ArticleBody
              content={article.content}
              middleAdHtml={settings?.ad_middle_html}
            />

            {error && (
              <p className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                className="btn-brand w-full sm:w-auto px-8"
                onClick={onContinue}
                disabled={remaining > 0 || advancing}
                data-testid="button-continue"
              >
                {advancing
                  ? "Loading…"
                  : remaining > 0
                  ? `Wait ${remaining}s…`
                  : isLastPage
                  ? "Get my code"
                  : "Continue"}
              </button>
              {remaining > 0 && (
                <p className="text-[11px] text-gray-500">
                  Please read the article — button unlocks shortly.
                </p>
              )}
            </div>
          </article>
        ) : null}

        <AdSlot html={settings?.ad_bottom_html} className="mt-6" />
      </main>
    </div>
  );
}

function ArticleBody({ content, middleAdHtml }: { content: string; middleAdHtml?: string }) {
  const paras = content.split(/\n\s*\n/).filter(Boolean);
  const mid = Math.floor(paras.length / 2);
  return (
    <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
      {paras.map((p, i) => (
        <div key={i}>
          <p className="mb-4 whitespace-pre-line">{p}</p>
          {i === mid - 1 && middleAdHtml ? <AdSlot html={middleAdHtml} className="my-4" /> : null}
        </div>
      ))}
    </div>
  );
}

function CodeReveal({
  code,
  copied,
  setCopied,
}: {
  code: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="card text-center fade-in">
      <div className="mx-auto mb-3 h-14 w-14 rounded-full flex items-center justify-center text-white text-2xl"
        style={{ background: "var(--brand-color)" }}>
        ✓
      </div>
      <h2 className="text-xl font-bold mb-2">You're done!</h2>
      <p className="text-sm text-gray-600 mb-5">
        Copy the code below and paste it back in the app to unlock your reward.
      </p>
      <div
        className="text-3xl font-mono font-bold tracking-[0.3em] bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl py-5 select-all mb-4"
        data-testid="text-code"
      >
        {code}
      </div>
      <button className="btn-brand w-full" onClick={copy} data-testid="button-copy-code">
        {copied ? "Copied!" : "Copy code"}
      </button>
      <p className="mt-4 text-[11px] text-gray-400">
        This code is valid for one verification only.
      </p>
    </div>
  );
}
