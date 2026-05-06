import { supabase, getSettings, pubDb, getPubSettings } from "./supabase.js";

export interface Article {
  id?: string;
  title: string;
  content: string;
  image_url?: string | null;
  topic?: string;
}

export interface ArticleSection {
  title: string;
  content: string;
  image_url: string | null;
}

export interface MultiSectionArticle {
  title: string;
  cover_url: string | null;
  sections: ArticleSection[];
}

const FALLBACK_TOPICS = ["technology", "crypto", "science", "health", "travel", "finance"];

const FALLBACK_ARTICLES: Article[] = [
  {
    title: "The Rise of Decentralized Finance",
    content:
      "Decentralized Finance (DeFi) is reshaping how people interact with money. By removing intermediaries and using blockchain-based smart contracts, DeFi protocols offer lending, borrowing, and trading with full transparency. Adoption keeps growing year after year as users discover the benefits of self-custody and global access.\n\nThis week we look at the most active protocols, their strengths, and how everyday users are putting them to work — from earning passive yield to hedging against inflation. The road ahead is exciting, with cross-chain bridges making the experience smoother than ever.",
    image_url: null,
    topic: "crypto",
  },
  {
    title: "AI Tools That Actually Save You Time",
    content:
      "Not every AI tool lives up to the hype, but a handful have become indispensable for daily work. From transcription assistants that turn meetings into structured notes, to image generators that produce production-ready visuals in seconds, the bar for quality has shifted dramatically.\n\nWe rounded up the tools we keep coming back to and explain exactly which problem each one solves best, so you can pick what fits your workflow without wading through endless feature lists.",
    image_url: null,
    topic: "technology",
  },
  {
    title: "5 Habits of Highly Productive Remote Teams",
    content:
      "Remote work has matured. The teams that thrive now share a few clear habits: focused async communication, well-structured documentation, and a strong rhythm of weekly check-ins. They protect deep-work time fiercely and use video selectively, not as a default.\n\nIn this piece we break down each habit with concrete examples you can try this week with your own team — including templates for handoff notes and a lightweight weekly status format.",
    image_url: null,
    topic: "productivity",
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Multi-provider chat completion ────────────────────────────────────────
export interface AiModelConfig {
  id?: string;
  provider: string;          // openai | gemini | deepseek | anthropic | openrouter | custom
  model: string;
  api_key: string;
  base_url?: string | null;
  language?: string | null;
}

async function loadDefaultModel(modelId?: string | null): Promise<AiModelConfig | null> {
  // 1) explicit choice
  if (modelId) {
    const { data } = await pubDb
      .from("shortlink_ai_models")
      .select("id, provider, model, api_key, base_url, language, is_active")
      .eq("id", modelId)
      .maybeSingle();
    if (data && data.is_active !== false) return data as AiModelConfig;
  }
  // 2) default flagged
  const { data: def } = await pubDb
    .from("shortlink_ai_models")
    .select("id, provider, model, api_key, base_url, language, is_active")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def) return def as AiModelConfig;
  // 3) any active
  const { data: any1 } = await pubDb
    .from("shortlink_ai_models")
    .select("id, provider, model, api_key, base_url, language")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (any1) return any1 as AiModelConfig;
  // 4) legacy single-provider settings fall-back
  const settings = await getPubSettings();
  if (settings.ai_api_key) {
    return {
      provider: (settings.ai_provider || "openai").toLowerCase(),
      model: settings.ai_model || "gpt-4o-mini",
      api_key: settings.ai_api_key,
      language: settings.ai_language || "en",
    };
  }
  return null;
}

async function callChat(model: AiModelConfig, system: string, user: string, jsonMode = true): Promise<string | null> {
  const provider = (model.provider || "openai").toLowerCase();
  try {
    if (provider === "openai" || provider === "openrouter" || provider === "deepseek" || provider === "custom") {
      const baseUrl =
        model.base_url ||
        (provider === "openrouter" ? "https://openrouter.ai/api/v1" :
         provider === "deepseek"   ? "https://api.deepseek.com/v1" :
                                     "https://api.openai.com/v1");
      const r = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${model.api_key}`,
          ...(provider === "openrouter" ? { "HTTP-Referer": "https://shortlink", "X-Title": "Publisher AI" } : {}),
        },
        body: JSON.stringify({
          model: model.model,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature: 0.85,
          ...(jsonMode && (provider === "openai" || provider === "deepseek") ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!r.ok) { console.warn("[AI chat] non-200:", provider, r.status, (await r.text()).slice(0, 400)); return null; }
      const j = await r.json();
      return j.choices?.[0]?.message?.content || null;
    }
    if (provider === "gemini") {
      const m = encodeURIComponent(model.model || "gemini-1.5-flash");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(model.api_key)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { temperature: 0.85, ...(jsonMode ? { responseMimeType: "application/json" } : {}) },
        }),
      });
      if (!r.ok) { console.warn("[AI gemini] non-200:", r.status, (await r.text()).slice(0, 400)); return null; }
      const j = await r.json();
      return j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || null;
    }
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": model.api_key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model.model,
          system,
          max_tokens: 8000,
          temperature: 0.85,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!r.ok) { console.warn("[AI anthropic] non-200:", r.status, (await r.text()).slice(0, 400)); return null; }
      const j = await r.json();
      return j.content?.[0]?.text || null;
    }
  } catch (e) {
    console.warn("[AI chat] error:", e);
  }
  return null;
}

// Try to extract JSON from a string that may contain ```json fences or extra text.
function safeParseJson<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  let s = raw.trim();
  // strip markdown fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(s) as T; } catch { /* try to find a JSON object substring */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as T; } catch { /* fall through */ } }
  return null;
}

// ─── Public: legacy single-article generator (used by random reader) ───────
export async function generateArticleViaAI(topic: string): Promise<Article | null> {
  const model = await loadDefaultModel();
  if (!model) return null;
  const language = model.language || "en";
  const prompt = `Write an engaging short article in ${language} about "${topic}".
Return STRICT JSON ONLY (no markdown fences) with exactly this shape:
{"title": "<8-12 word title>", "content": "<400-600 word body, 3-4 paragraphs, plain text>"}`;
  const raw = await callChat(model, "You write concise, engaging blog articles. Output STRICT JSON only.", prompt, true);
  const parsed = safeParseJson<{ title: string; content: string }>(raw);
  if (!parsed?.title || !parsed?.content) return null;

  let imageUrl: string | null = null;
  // Image generation only supported via openai-style endpoint right now.
  if ((model.provider || "openai").toLowerCase() === "openai") {
    try {
      const settings = await getPubSettings();
      const imgModel = settings.ai_image_model || "dall-e-3";
      const ir = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${model.api_key}` },
        body: JSON.stringify({
          model: imgModel,
          prompt: `Realistic editorial cover image for an article titled: "${parsed.title}". Topic: ${topic}. High quality, professional, no text overlays.`,
          n: 1, size: "1024x1024",
        }),
      });
      if (ir.ok) {
        const ij = await ir.json();
        imageUrl = ij.data?.[0]?.url || null;
      }
    } catch (e) { console.warn("[AI image] failed:", e); }
  }

  return { title: parsed.title, content: parsed.content, image_url: imageUrl, topic };
}

// ─── Public: multi-section generator for the publisher editor ──────────────
export async function generateArticleSectionsViaAI(opts: {
  topic: string;
  modelId?: string | null;
  language?: string | null;
  minSections?: number;
  minChars?: number;
}): Promise<MultiSectionArticle | null> {
  const model = await loadDefaultModel(opts.modelId);
  if (!model) return null;

  const minSections = Math.max(3, opts.minSections || 3);
  const minChars = Math.max(2000, opts.minChars || 5000);
  const language = opts.language || model.language || "ar";

  const sectionPrompt = (sectionTopic: string) =>
    `Write the BODY of a long-form article section in ${language} about: "${sectionTopic}".
Audience: general readers. Tone: professional, engaging, well-structured with clear paragraphs and short sub-headings (using bold markdown ** ** when helpful).
LENGTH REQUIREMENT: at least ${minChars} characters of natural prose (around ${Math.round(minChars / 5)} words). Do NOT pad with filler — be informative.
Return STRICT JSON ONLY: {"title": "<short H2 title 4-10 words>", "content": "<the long body, plain text + simple markdown>"}`;

  // 1) Build a section outline
  const outlinePrompt = `Create a long-form article outline in ${language} on the topic: "${opts.topic}".
Return STRICT JSON ONLY: {"title": "<full article title>", "sections": [{"heading": "<section title>"}, ...]}.
Provide exactly ${minSections} sections. Each section should cover a distinct angle.`;
  const outlineRaw = await callChat(
    model,
    "You are a senior editor. Output STRICT JSON only — no markdown fences.",
    outlinePrompt,
    true,
  );
  const outline = safeParseJson<{ title: string; sections: { heading: string }[] }>(outlineRaw);
  if (!outline?.title || !Array.isArray(outline.sections) || outline.sections.length < minSections) {
    return null;
  }

  // 2) Generate each section concurrently
  const sectionResults = await Promise.all(
    outline.sections.slice(0, Math.max(minSections, outline.sections.length)).map(async (s) => {
      const raw = await callChat(
        model,
        "You write detailed, well-researched article sections. Output STRICT JSON only.",
        sectionPrompt(s.heading || opts.topic),
        true,
      );
      const parsed = safeParseJson<{ title: string; content: string }>(raw);
      if (!parsed?.title || !parsed?.content || parsed.content.length < Math.floor(minChars * 0.6)) return null;
      return { title: parsed.title, content: parsed.content, image_url: null as string | null };
    }),
  );

  const validSections = sectionResults.filter(Boolean) as ArticleSection[];
  if (validSections.length < minSections) return null;

  // 3) Try to generate cover + per-section images (openai only). Failures are non-fatal.
  let coverUrl: string | null = null;
  if ((model.provider || "openai").toLowerCase() === "openai") {
    try {
      const settings = await getPubSettings();
      const imgModel = settings.ai_image_model || "dall-e-3";
      const ir = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${model.api_key}` },
        body: JSON.stringify({
          model: imgModel,
          prompt: `Editorial cover image for: "${outline.title}". High quality, professional, no text overlays.`,
          n: 1, size: "1024x1024",
        }),
      });
      if (ir.ok) {
        const ij = await ir.json();
        coverUrl = ij.data?.[0]?.url || null;
      }
      // per-section: best effort, sequential to avoid rate limits
      for (const sec of validSections) {
        try {
          const r2 = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${model.api_key}` },
            body: JSON.stringify({
              model: imgModel,
              prompt: `Illustration for an article section titled: "${sec.title}". Topic: ${opts.topic}. Editorial, high quality, no text overlays.`,
              n: 1, size: "1024x1024",
            }),
          });
          if (r2.ok) {
            const j2 = await r2.json();
            sec.image_url = j2.data?.[0]?.url || null;
          }
        } catch (e) { console.warn("[AI sec image] failed:", e); }
      }
    } catch (e) { console.warn("[AI cover] failed:", e); }
  }

  return { title: outline.title, cover_url: coverUrl, sections: validSections };
}

/**
 * Get N articles for a session. Tries AI first, falls back to cached articles,
 * finally to built-in fallbacks. Persists generated ones to shortlink_articles.
 */
export async function getArticlesForSession(count: number): Promise<Article[]> {
  const settings = await getPubSettings();
  const topics: string[] =
    Array.isArray(settings.ai_topics) && settings.ai_topics.length > 0
      ? settings.ai_topics
      : FALLBACK_TOPICS;

  const out: Article[] = [];

  for (let i = 0; i < count; i++) {
    const topic = pickRandom(topics);

    const ai = await generateArticleViaAI(topic);
    if (ai) {
      const { data: saved } = await supabase
        .from("shortlink_articles")
        .insert({
          topic: ai.topic || topic,
          title: ai.title,
          content: ai.content,
          image_url: ai.image_url,
          language: settings.ai_language || "en",
          use_count: 1,
        })
        .select()
        .single();
      out.push(saved || ai);
      continue;
    }

    // Try cache first
    const { data: cached } = await supabase
      .from("shortlink_articles")
      .select("*")
      .eq("topic", topic)
      .order("use_count", { ascending: true })
      .limit(1);
    if (cached && cached.length > 0) {
      const a = cached[0];
      await supabase
        .from("shortlink_articles")
        .update({ use_count: (a.use_count || 0) + 1 })
        .eq("id", a.id);
      out.push(a as Article);
      continue;
    }

    // Final fallback
    out.push(pickRandom(FALLBACK_ARTICLES));
  }

  return out;
}
