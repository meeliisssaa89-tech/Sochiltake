async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("sl_pub_token") || "";
  const r = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!r.ok) throw new Error(json.error || json.message || `Request failed (${r.status})`);
  return json as T;
}

export interface Publisher {
  id: string;
  email: string;
  display_name?: string | null;
  link_code: string;
  pending_balance: number;
  lifetime_earnings?: number;
  total_visits?: number;
  linked_telegram_id?: string | null;
}

export interface PubArticle {
  id: string;
  slug: string;
  title: string;
  content?: string;
  cover_url?: string | null;
  status: "pending" | "approved" | "rejected";
  visit_count: number;
  earnings: number;
  created_at: string;
  rejection_reason?: string | null;
}

export const pubApi = {
  status: () => request<{ publishers_enabled: boolean; signup_enabled: boolean; site_title: string; brand_color: string }>("/api/publisher/status"),

  signup: (email: string, password: string, display_name?: string) =>
    request<{ ok: true; token: string; publisher: Publisher }>("/api/publisher/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),

  login: (email: string, password: string) =>
    request<{ ok: true; token: string; publisher: Publisher }>("/api/publisher/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: true }>("/api/publisher/logout", { method: "POST" }),

  me: () => request<{ publisher: Publisher; articles: PubArticle[] }>("/api/publisher/me"),

  listArticles: () => request<{ articles: PubArticle[] }>("/api/publisher/articles"),

  createArticle: (title: string, content: string, cover_url?: string) =>
    request<{ article: PubArticle }>("/api/publisher/articles", {
      method: "POST",
      body: JSON.stringify({ title, content, cover_url }),
    }),

  updateArticle: (id: string, patch: { title?: string; content?: string; cover_url?: string | null }) =>
    request<{ ok: true }>(`/api/publisher/articles?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteArticle: (id: string) =>
    request<{ ok: true }>(`/api/publisher/articles?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  viewArticle: (slug: string) =>
    request<{ article: PubArticle; settings: any }>(`/api/p/view?slug=${encodeURIComponent(slug)}`),
};

export function setPubToken(token: string) {
  localStorage.setItem("sl_pub_token", token);
}
export function clearPubToken() {
  localStorage.removeItem("sl_pub_token");
}
export function hasPubToken(): boolean {
  return !!localStorage.getItem("sl_pub_token");
}
