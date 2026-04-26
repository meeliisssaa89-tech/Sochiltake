import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { pubApi } from "../lib/publisherApi";
import { AdSlot, injectHeadHtml } from "../components/AdSlot";

export default function PublicArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const headInjected = useRef(false);

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
      })
      .catch((e) => setErr(e.message));
  }, [slug]);

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

  return (
    <div className="min-h-screen" style={{ "--brand-color": brand } as React.CSSProperties}>
      <header className="px-4 py-3 border-b border-gray-200 bg-white sticky top-0">
        <p className="text-sm font-bold" style={{ color: brand }}>{settings.site_title || "Articles Hub"}</p>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <AdSlot html={settings.ad_top_html} />
        {a.cover_url && (
          <img src={a.cover_url} alt={a.title} className="w-full rounded-2xl object-cover max-h-72" />
        )}
        <h1 className="text-2xl font-bold leading-tight">{a.title}</h1>
        <p className="text-xs text-gray-500">
          Published {new Date(a.created_at).toLocaleDateString()}
        </p>
        <article className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
          {/* split content into paragraphs and inject middle ad */}
          {(() => {
            const text = String(a.content || "");
            const paras = text.split(/\n\s*\n/).filter(Boolean);
            const half = Math.ceil(paras.length / 2);
            return (
              <>
                {paras.slice(0, half).map((p, i) => <p key={`a${i}`}>{p}</p>)}
                {settings.ad_middle_html && <AdSlot html={settings.ad_middle_html} />}
                {paras.slice(half).map((p, i) => <p key={`b${i}`}>{p}</p>)}
              </>
            );
          })()}
        </article>
        <AdSlot html={settings.ad_bottom_html} />
      </main>
      <footer className="text-center text-xs text-gray-400 py-6">
        © {new Date().getFullYear()} {settings.site_title || "Articles Hub"}
      </footer>
    </div>
  );
}
