import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { pubApi, hasPubToken } from "../lib/publisherApi";

export default function PubEditorPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const editing = !!id && id !== "new";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!hasPubToken()) { nav("/publisher/login"); return; }
    document.title = editing ? "Edit article" : "New article";
    if (editing) {
      pubApi.listArticles().then((r) => {
        const a = r.articles.find((x) => x.id === id);
        if (a) {
          setTitle(a.title);
          setContent(a.content || "");
          setCoverUrl(a.cover_url || "");
        }
        setLoading(false);
      }).catch((e) => { setErr(e.message); setLoading(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (editing) {
        await pubApi.updateArticle(id!, { title, content, cover_url: coverUrl || null });
      } else {
        await pubApi.createArticle(title, content, coverUrl || undefined);
      }
      nav("/publisher/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-center text-sm">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-bold">{editing ? "Edit article" : "New article"}</h1>
          <Link to="/publisher/dashboard" className="text-xs text-gray-500">← Back</Link>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="text-[11px] text-gray-500">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              minLength={4}
              data-testid="input-article-title"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Cover image URL (optional)</label>
            <input
              className="input"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…/image.jpg"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500">Content (plain text or simple HTML, 30+ chars)</label>
            <textarea
              className="input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              required
              minLength={30}
              data-testid="textarea-article-content"
            />
            <p className="text-[10px] text-gray-400 mt-1">{content.length} characters</p>
          </div>
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <button className="btn-brand w-full" disabled={busy} data-testid="button-save-article">
            {busy ? "Saving…" : (editing ? "Update article" : "Publish article")}
          </button>
          <p className="text-[10px] text-gray-500 text-center">
            New & edited articles may need admin approval before going public.
          </p>
        </form>
      </div>
    </div>
  );
}
