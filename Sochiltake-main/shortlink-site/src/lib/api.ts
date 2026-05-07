async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const text = await r.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!r.ok) {
    const msg = json.error || json.message || `Request failed (${r.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export interface Article {
  title: string;
  content: string;
  image_url?: string | null;
}

export interface SiteSettings {
  site_title: string;
  brand_color: string;
  ad_head_html?: string;
  ad_top_html?: string;
  ad_middle_html?: string;
  ad_bottom_html?: string;
  ad_interstitial_html?: string;
}

export interface StartResponse {
  session_id: string;
  page_count: number;
  wait_seconds: number;
  pages_done: number;
  completed: boolean;
  code: string | null;
  settings: SiteSettings;
  article: Article;
}

export interface PageResponse {
  page: number;
  total_pages: number;
  pages_done: number;
  wait_seconds: number;
  article: Article;
  completed: boolean;
  code: string | null;
}

export const api = {
  start: (user_id: string, token: string) =>
    request<StartResponse>("/api/start", {
      method: "POST",
      body: JSON.stringify({ user_id, token }),
    }),

  page: (session_id: string, page: number) =>
    request<PageResponse>("/api/page", {
      method: "POST",
      body: JSON.stringify({ session_id, page }),
    }),

  // -- Admin: auth + reader settings ----------------------------------------
  adminLogin: (password: string) =>
    request<{ ok: true }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  adminGetSettings: () => request<any>("/api/admin/settings"),

  adminSaveSettings: (settings: any) =>
    request<{ ok: true }>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  adminPreview: (topic: string) =>
    request<Article>("/api/admin/preview", {
      method: "POST",
      body: JSON.stringify({ topic }),
    }),

  adminStats: () => request<{
    sessions_total: number;
    sessions_completed: number;
    sessions_today: number;
    cached_articles: number;
    publishers_total: number;
    pub_articles_total: number;
    pub_articles_pending: number;
    total_pending_balance: number;
    total_available_balance: number;
    total_lifetime_revenue: number;
  }>("/api/admin/stats"),

  // -- Admin: publisher program settings ------------------------------------
  adminGetPubSettings: () => request<any>("/api/admin/pub_settings"),

  adminSavePubSettings: (settings: any) =>
    request<{ ok: true }>("/api/admin/pub_settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),

  // -- Admin: publisher article moderation ----------------------------------
  adminGetPubArticles: (status?: string) =>
    request<{ articles: any[] }>(
      `/api/admin/pub_articles${status ? `?status=${encodeURIComponent(status)}` : ""}`
    ),

  adminReviewArticle: (id: string, action: "approve" | "reject", reason?: string) =>
    request<{ ok: true; status: string }>("/api/admin/pub_article_action", {
      method: "POST",
      body: JSON.stringify({ id, action, reason }),
    }),

  // -- Admin: publishers management ----------------------------------------
  adminGetPublishers: () =>
    request<{ publishers: any[] }>("/api/admin/pub_publishers"),

  adminPublisherAction: (id: string, action: string, amount?: number) =>
    request<{ ok: true; released?: number }>("/api/admin/pub_publisher_action", {
      method: "POST",
      body: JSON.stringify({ id, action, amount }),
    }),
};
