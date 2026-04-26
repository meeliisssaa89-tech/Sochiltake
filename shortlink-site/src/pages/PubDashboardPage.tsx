import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { pubApi, clearPubToken, hasPubToken, Publisher, PubArticle } from "../lib/publisherApi";

export default function PubDashboardPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<Publisher | null>(null);
  const [articles, setArticles] = useState<PubArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasPubToken()) { nav("/publisher/login"); return; }
    document.title = "Publisher Dashboard";
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await pubApi.me();
      setMe(r.publisher);
      setArticles(r.articles);
    } catch (e: any) {
      setErr(e.message);
      if (String(e.message || "").toLowerCase().includes("sign")) {
        clearPubToken();
        nav("/publisher/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    try { await pubApi.logout(); } catch { /* ignore */ }
    clearPubToken();
    nav("/publisher/login");
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await pubApi.deleteArticle(id);
    refresh();
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return <p className="p-6 text-center text-sm">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500">Welcome back</p>
            <h1 className="text-lg font-bold">{me?.display_name || me?.email}</h1>
            <p className="text-[10px] text-gray-500">{me?.email}</p>
          </div>
          <button onClick={onLogout} className="text-xs text-gray-500 hover:text-red-600">Sign out</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Pending" value={Number(me?.pending_balance || 0).toFixed(4)} />
          <Stat label="Lifetime" value={Number(me?.lifetime_earnings || 0).toFixed(4)} />
          <Stat label="Visits" value={String(me?.total_visits || 0)} />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-purple-50 border border-purple-100">
          <p className="text-[11px] text-purple-700 font-medium mb-1">
            Your link-code (paste into the Telegram app to claim earnings):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-white rounded px-2 py-1 border border-purple-200" data-testid="text-link-code">
              {me?.link_code}
            </code>
            <button onClick={() => copy(me?.link_code || "")} className="text-xs text-purple-700 font-medium">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          {me?.linked_telegram_id ? (
            <p className="text-[10px] text-green-700 mt-2">✓ Linked to Telegram ID {me.linked_telegram_id}</p>
          ) : (
            <p className="text-[10px] text-gray-500 mt-2">Not linked yet — open the Telegram app & paste this code.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">My Articles</h2>
          <Link to="/publisher/article/new" className="btn-brand text-xs px-3 py-1.5" data-testid="button-new-article">+ New article</Link>
        </div>

        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
        {articles.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">You haven't written anything yet.</p>
        )}

        <div className="space-y-2">
          {articles.map((a) => (
            <div key={a.id} className="border border-gray-200 rounded-lg p-3" data-testid={`article-${a.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm truncate">{a.title}</h3>
                  <p className="text-[10px] text-gray-500">
                    {new Date(a.created_at).toLocaleDateString()} · /p/{a.slug} · {a.visit_count} visits · {Number(a.earnings).toFixed(4)} earned
                  </p>
                  {a.rejection_reason && (
                    <p className="text-[10px] text-red-600 mt-1">Rejected: {a.rejection_reason}</p>
                  )}
                </div>
                <StatusBadge s={a.status} />
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                {a.status === "approved" && (
                  <a href={`/p/${a.slug}`} target="_blank" rel="noreferrer" className="text-purple-600">View</a>
                )}
                <Link to={`/publisher/article/${a.id}/edit`} className="text-blue-600">Edit</Link>
                <button onClick={() => remove(a.id)} className="text-red-600 ml-auto">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 text-center">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="font-bold text-sm tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ s }: { s: PubArticle["status"] }) {
  const colors: Record<string, string> = {
    approved: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colors[s]}`}>{s}</span>
  );
}
