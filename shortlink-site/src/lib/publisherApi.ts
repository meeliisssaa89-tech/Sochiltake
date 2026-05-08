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

export interface ArticleSection {
  title: string;
  content: string;
  image_url: string | null;
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
  sections?: ArticleSection[];
  source?: string;
  linked_shortlink_code?: string | null;
}

export interface PubShortlink {
  id: string;
  title: string | null;
  original_url: string;
  short_code: string;
  short_url: string;
  visit_count: number;
  earnings: number;
  is_active: boolean;
  created_at: string;
}

export interface AiModelLite {
  id: string;
  provider: string;
  display_name: string;
  is_default: boolean;
}

export interface ArticleInput {
  title: string;
  cover_url?: string | null;
  sections: ArticleSection[];
  linked_shortlink_code?: string | null;
}

export const pubApi = {
  status: () => request<{
    publishers_enabled: boolean; signup_enabled: boolean;
    site_title: string; brand_color: string;
    min_sections: number; min_section_chars: number;
  }>("/api/publisher/status"),

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

  createArticle: (input: ArticleInput) =>
    request<{ article: PubArticle }>("/api/publisher/articles", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateArticle: (id: string, patch: Partial<ArticleInput>) =>
    request<{ ok: true }>(`/api/publisher/articles?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteArticle: (id: string) =>
    request<{ ok: true }>(`/api/publisher/articles?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  viewArticle: (slug: string) =>
    request<{ article: PubArticle; settings: any }>(`/api/p/view?slug=${encodeURIComponent(slug)}`),

  listAiModels: () =>
    request<{ models: AiModelLite[] }>("/api/publisher/ai_models"),

  aiGenerate: (topic: string, model_id?: string, language?: string) =>
    request<{ article: { title: string; cover_url: string | null; sections: ArticleSection[] } }>(
      "/api/publisher/ai_generate",
      { method: "POST", body: JSON.stringify({ topic, model_id, language }) },
    ),

  listShortlinks: () =>
    request<{ shortlinks: PubShortlink[]; site_url: string }>("/api/publisher/shortlinks"),

  createShortlink: (original_url: string, title?: string) =>
    request<{ ok: true; id: string; short_code: string; short_url: string }>(
      "/api/publisher/shortlinks",
      { method: "POST", body: JSON.stringify({ op: "create", original_url, title }) },
    ),

  deleteShortlink: (id: string) =>
    request<{ ok: true }>("/api/publisher/shortlinks", {
      method: "POST",
      body: JSON.stringify({ op: "delete", id }),
    }),

  toggleShortlink: (id: string) =>
    request<{ ok: true; is_active: boolean }>("/api/publisher/shortlinks", {
      method: "POST",
      body: JSON.stringify({ op: "toggle", id }),
    }),
};

export function setPubToken(token: string)  { localStorage.setItem("sl_pub_token", token); }
export function clearPubToken()             { localStorage.removeItem("sl_pub_token"); }
export function hasPubToken(): boolean      { return !!localStorage.getItem("sl_pub_token"); }
