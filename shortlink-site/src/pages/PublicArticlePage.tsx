import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { pubApi, ArticleSection } from "../lib/publisherApi";
import { AdSlot, injectHeadHtml } from "../components/AdSlot";

// Render simple **bold** / *italic* and turn blank lines into paragraphs.
function renderRich(text: string) {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = escape(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
  return html;
}

export default function PublicArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const userId = params.get("u") || params.get("user_id") || "";
  const taskToken = params.get("t") || params.get("token") || "";
  const isCodeMode = !!(userId && taskToken);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [tabsRead, setTabsRead] = useState<Set<number>>(new Set([0]));
  const [waitRemaining, setWaitRemaining] = useState(0);
  const [waitPerTab, setWaitPerTab] = useState(8);
  const [code, setCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const headInjected = useRef(false);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!slug) return;
    document.title = "Article";
    pubApi.viewArticle(slug)
      .then((r) => {
        setData(r);
        document.title = r.article.title;
        if (!headInjected.current && r.settings?.ad_head_html) {
          injectHeadHtml(r.settings.ad_head_html);
          headInjected.current = true;
        }
        const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
        if (meta && r.settings?.brand_color) meta.content = r.settings.brand_color;
        const wait = Number(r.settings?.wait_seconds || 8);
        setWaitPerTab(Math.max(2, Math.min(120, wait)));
        setWaitRemaining(Math.max(2, Math.min(120, wait)));
      })
      .catch((e) => setErr(e.message));
  }, [slug]);

  // countdown for current tab — only relevant when in code-task mode
  useEffect(() => {
    if (!isCodeMode || code) return;
    if (waitRemaining <= 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastTickRef.current < 900) return;
      lastTickRef.current = now;
      setWaitRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [waitRemaining, isCodeMode, code, activeTab]);

  if (err) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-sm text-center">
        <p className="text-sm text-red-600">{err}</p>
      </div>
    </div>
  );
  if (!data) return <p className="p-8 text-center text-sm text-gray-500">Loading…</p>;

  const a = data.article;
  const settings = data.settings || {};
  const brand = settings.brand_color || "#7c3aed";

  // Resolve sections (legacy: build a single section from `content`)
  const rawSections: ArticleSection[] = Array.isArray(a.sections) && a.sections.length > 0
    ? a.sections
    : [{ title: a.title, content: a.content || "", image_url: a.cover_url || null }];

  const total = rawSections.length;
  const allRead = isCodeMode ? tabsRead.size >= total : true;

  const goTab = (i: number) => {
    setActiveTab(i);
    setTabsRead((prev) => new Set([...Array.from(prev), i]));
    setWaitRemaining(waitPerTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onClaimCode = async () => {
    if (!isCodeMode || codeBusy || code) return;
    setCodeBusy(true);
    setCodeErr(null);
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
    } finally {
      setCodeBusy(false);
    }
  };

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const current = rawSections[activeTab] || rawSections[0];

  return (
    <div className="min-h-screen pb-12" style={{ "--brand-color": brand } as React.CSSProperties}>
      <header className="px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="text-sm font-bold" style={{ color: brand }}>{settings.site_title || "Articles Hub"}</p>
          {isCodeMode && (
            <p className="text-[11px] text-gray-500">
              Read all tabs ({tabsRead.size}/{total}) to unlock your code
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <AdSlot html={settings.ad_top_html} />
        {(a.cover_url || current.image_url) && (
          <img src={a.cover_url || current.image_url || ""} alt={a.title}
            className="w-full rounded-2xl object-cover max-h-72" />
        )}
        <h1 className="text-2xl md:text-3xl font-bold leading-tight">{a.title}</h1>
        <p className="text-xs text-gray-500">
          Published {new Date(a.created_at).toLocaleDateString()}
        </p>

        {/* Tab strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-gray-200">
          {rawSections.map((s, i) => {
            const wasRead = tabsRead.has(i);
            return (
              <button
                key={i}
                onClick={() => goTab(i)}
                className={`shrink-0 text-xs px-3 py-2 -mb-px border-b-2 font-medium transition-colors ${
                  activeTab === i
                    ? "border-purple-600 text-purple-700"
                    : wasRead
                      ? "border-transparent text-gray-700 hover:text-purple-600"
                      : "border-transparent text-gray-400 hover:text-purple-600"
                }`}
                data-testid={`tab-public-${i}`}
              >
                {i + 1}. {s.title?.slice(0, 24) || `Section ${i + 1}`}
                {wasRead && <span className="ms-1 text-green-600">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Active section */}
        <article className="prose prose-sm md:prose-base max-w-none">
          {current.image_url && current.image_url !== a.cover_url && (
            <img src={current.image_url} alt={current.title}
              className="w-full rounded-xl object-cover max-h-80 mb-4" />
          )}
          <h2 className="text-xl md:text-2xl font-bold mt-0">{current.title}</h2>
          {(() => {
            const paras = String(current.content || "").split(/\n\s*\n/).filter(Boolean);
            const half = Math.ceil(paras.length / 2);
            return (
              <>
                {paras.slice(0, half).map((p, i) => (
                  <p key={`a${i}`} dangerouslySetInnerHTML={{ __html: renderRich(p) }} />
                ))}
                {settings.ad_middle_html && <AdSlot html={settings.ad_middle_html} />}
                {paras.slice(half).map((p, i) => (
                  <p key={`b${i}`} dangerouslySetInnerHTML={{ __html: renderRich(p) }} />
                ))}
              </>
            );
          })()}
        </article>

        {/* Pager */}
        {total > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => goTab(Math.max(0, activeTab - 1))}
              disabled={activeTab === 0}
              className="text-xs px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
              ← Previous tab
            </button>
            <button
              onClick={() => goTab(Math.min(total - 1, activeTab + 1))}
              disabled={activeTab >= total - 1}
              className="text-xs px-3 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
              data-testid="button-next-tab">
              Next tab →
            </button>
          </div>
        )}

        <AdSlot html={settings.ad_bottom_html} />

        {/* Code-task call-to-action */}
        {isCodeMode && (
          <div className="card border-purple-200 bg-purple-50">
            {!code ? (
              <>
                <p className="text-sm font-bold text-purple-800 mb-1">
                  📝 Verification code for your task
                </p>
                <p className="text-xs text-gray-700 mb-3">
                  Read all {total} tabs (you've read {tabsRead.size}). Wait timer: <strong>{waitRemaining}s</strong> remaining on this tab.
                </p>
                <button
                  onClick={onClaimCode}
                  disabled={codeBusy || !allRead || waitRemaining > 0}
                  className="btn-brand w-full disabled:opacity-50"
                  data-testid="button-claim-code">
                  {codeBusy
                    ? "Generating…"
                    : !allRead
                      ? `Read remaining ${total - tabsRead.size} tab(s) to unlock`
                      : waitRemaining > 0
                        ? `Wait ${waitRemaining}s on this tab`
                        : "Get verification code"}
                </button>
                {codeErr && <p className="text-xs text-red-600 mt-2">{codeErr}</p>}
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-green-700 mb-2">
                  ✅ Your one-time code
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-lg font-mono font-bold text-purple-800 bg-white border border-purple-200 rounded p-3 text-center select-all" data-testid="text-final-code">
                    {code}
                  </code>
                  <button onClick={copyCode} className="text-xs px-3 py-2 rounded bg-purple-600 text-white">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Return to the Telegram app and paste this code to claim your reward.
                </p>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        © {new Date().getFullYear()} {settings.site_title || "Articles Hub"}
      </footer>
    </div>
  );
}
