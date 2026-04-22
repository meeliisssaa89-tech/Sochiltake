import { supabase } from "@/integrations/supabase/client";

export interface NotifyOptions {
  title: string;
  description?: string;
  rewardAmount: number;
  rewardSymbol?: string;
  rewardIconUrl?: string | null;
  xpReward?: number;
  promoCode?: string;
  featuredUser?: {
    name: string;
    photoUrl?: string | null;
  } | null;
  webAppUrl?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildCaption(o: NotifyOptions, kind: "task" | "promo"): string {
  const lines: string[] = [];
  const header = kind === "task" ? "🆕 <b>New Task!</b>" : "🎁 <b>New Promo Code!</b>";
  lines.push(header);
  lines.push("");
  lines.push(`📌 <b>${escapeHtml(o.title)}</b>`);
  if (o.description) lines.push(escapeHtml(o.description));
  lines.push("");
  const coin = o.rewardIconUrl ? "🪙" : "💰";
  const sym = o.rewardSymbol ? ` ${escapeHtml(o.rewardSymbol)}` : "";
  lines.push(`${coin} Reward: <b>${o.rewardAmount}${sym}</b>`);
  if (o.xpReward && o.xpReward > 0) lines.push(`⭐ XP: <b>${o.xpReward}</b>`);
  if (o.promoCode) lines.push(`🔑 Code: <code>${escapeHtml(o.promoCode)}</code>`);
  if (o.featuredUser?.name) {
    lines.push("");
    lines.push(`👤 Featured: <b>${escapeHtml(o.featuredUser.name)}</b>`);
  }
  lines.push("");
  lines.push("👇 Open the app to claim your reward.");
  return lines.join("\n");
}

export async function notifyNewContent(
  kind: "task" | "promo",
  options: NotifyOptions,
): Promise<{ sent: number; failed: number }> {
  const message = buildCaption(options, kind);

  const buttons: Array<{ text: string; url: string }> = [];
  if (options.webAppUrl) {
    buttons.push({ text: "🚀 Open App", url: options.webAppUrl });
  }

  const mediaUrl = options.featuredUser?.photoUrl || options.rewardIconUrl || null;
  const mediaType = mediaUrl ? "photo" : undefined;

  const { data, error } = await supabase.functions.invoke("broadcast-message", {
    body: {
      message,
      parse_mode: "HTML",
      media_url: mediaUrl,
      media_type: mediaType,
      buttons,
    },
  });
  if (error) throw error;
  return data as { sent: number; failed: number };
}
