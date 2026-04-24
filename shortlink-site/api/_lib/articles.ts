import { supabase, getSettings } from "./supabase.js";

export interface Article {
  id?: string;
  title: string;
  content: string;
  image_url?: string | null;
  topic?: string;
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
  {
    title: "Healthy Eating Without the Overwhelm",
    content:
      "Building healthier eating habits doesn't have to mean strict diets or complicated meal plans. Small, repeatable changes compound over time. Start with one swap each week — like trading a sugary drink for sparkling water with lemon — and let momentum do the rest.\n\nNutritionists agree: consistency beats perfection. Stock your kitchen with simple staples, plan two or three go-to dinners, and you'll find healthy choices become the default.",
    image_url: null,
    topic: "health",
  },
  {
    title: "Travel on a Budget: Smart Tips for 2026",
    content:
      "Traveling well doesn't require a huge budget — it requires planning. Use price-tracking tools to grab flights at the right window. Mix one or two splurge nights with budget stays. Eat where locals eat. These three rules alone can cut a trip's cost in half.\n\nWe also share our favorite tools for finding hidden gems and building flexible itineraries that adapt to weather and unexpected discoveries.",
    image_url: null,
    topic: "travel",
  },
  {
    title: "Understanding Personal Finance in Your 20s",
    content:
      "Your twenties are the perfect time to build habits that will pay off for decades. Start with an emergency fund, automate retirement contributions, and learn the difference between good debt and bad debt. The earlier you start, the more compound interest works in your favor.\n\nThis guide breaks down a simple framework you can use today — no spreadsheets required.",
    image_url: null,
    topic: "finance",
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateArticleViaAI(topic: string): Promise<Article | null> {
  const settings = await getSettings();
  const apiKey = settings.ai_api_key;
  if (!apiKey) return null;

  const model = settings.ai_model || "gpt-4o-mini";
  const language = settings.ai_language || "en";
  const provider = (settings.ai_provider || "openai").toLowerCase();

  const prompt = `Write an engaging short article in ${language} about "${topic}". 
Return STRICT JSON ONLY (no markdown fences) with exactly this shape:
{"title": "<8-12 word title>", "content": "<400-600 word body, 3-4 paragraphs, plain text>"}`;

  try {
    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You write concise, engaging blog articles. Output STRICT JSON only." },
            { role: "user", content: prompt },
          ],
          temperature: 0.85,
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) {
        console.warn("[AI] non-200:", r.status, await r.text());
        return null;
      }
      const json = await r.json();
      const text = json.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(text);
      if (!parsed.title || !parsed.content) return null;

      let imageUrl: string | null = null;
      try {
        const imgModel = settings.ai_image_model || "dall-e-3";
        const ir = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: imgModel,
            prompt: `Realistic editorial cover image for an article titled: "${parsed.title}". Topic: ${topic}. High quality, professional, no text overlays.`,
            n: 1,
            size: "1024x1024",
          }),
        });
        if (ir.ok) {
          const ij = await ir.json();
          imageUrl = ij.data?.[0]?.url || null;
        }
      } catch (e) {
        console.warn("[AI image] failed:", e);
      }

      return {
        title: parsed.title,
        content: parsed.content,
        image_url: imageUrl,
        topic,
      };
    }
  } catch (e) {
    console.warn("[AI] generate failed:", e);
  }
  return null;
}

/**
 * Get N articles for a session. Tries AI first, falls back to cached articles,
 * finally to built-in fallbacks. Persists generated ones to shortlink_articles.
 */
export async function getArticlesForSession(count: number): Promise<Article[]> {
  const settings = await getSettings();
  const topics: string[] =
    Array.isArray(settings.ai_topics) && settings.ai_topics.length > 0
      ? settings.ai_topics
      : FALLBACK_TOPICS;

  const out: Article[] = [];

  for (let i = 0; i < count; i++) {
    const topic = pickRandom(topics);

    if (settings.ai_api_key) {
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
