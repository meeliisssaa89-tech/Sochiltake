import { useAppSettings } from "@/hooks/useSupabaseData";

export type AdSlot = "daily_ads" | "tasks_page" | "home_checkin" | "spin_button" | "promo_redeem";

declare global {
  interface Window {
    Adsgram?: {
      init: (opts: { blockId: string; debug?: boolean }) => { show: () => Promise<{ done: boolean }> };
    };
    [k: string]: any;
  }
}

interface PlatformConfig {
  enabled: boolean;
  block_id: string;
  block_ids?: string[];
  zone_id: string;
  sdk_html: string;
  debug?: boolean;
}

interface AdsBindings {
  daily_ads: string;
  tasks_page: string;
  home_checkin: string;
  spin_button: string;
  promo_redeem: string;
}

export function useAdTrigger() {
  const { data: settings } = useAppSettings();

  const platforms: Record<string, PlatformConfig> = (settings?.ads_platforms as any) || {};
  const bindings: AdsBindings = (settings?.ads_bindings as any) || {
    daily_ads: "none",
    tasks_page: "none",
    home_checkin: "none",
    spin_button: "none",
    promo_redeem: "none",
  };
  const adsConfig: any = settings?.ads_daily || { duration_seconds: 15 };

  const getPlatform = (slot: AdSlot): string => (bindings as any)[slot] || "none";

  const getAllBlockIds = (cfg: PlatformConfig): string[] => {
    const ids = (cfg.block_ids || []).map((id) => id.trim()).filter(Boolean);
    if (ids.length > 0) return ids;
    if (cfg.block_id?.trim()) return [cfg.block_id.trim()];
    return [];
  };

  const triggerAdgram = async (blockId: string, debug = false): Promise<boolean> => {
    if (!blockId) return false;
    const sdk = window.Adsgram;
    if (!sdk) {
      console.warn("[Adsgram] SDK not loaded yet");
      return false;
    }
    try {
      const controller = sdk.init({ blockId, debug });
      const result = await controller.show();
      return result?.done !== false;
    } catch (err) {
      console.warn("[Adsgram] show failed:", err);
      return false;
    }
  };

  const triggerAllAdgram = async (cfg: PlatformConfig): Promise<boolean> => {
    const blockIds = getAllBlockIds(cfg);
    if (blockIds.length === 0) return false;
    let anyOk = false;
    for (let i = 0; i < blockIds.length; i++) {
      const bid = blockIds[i];
      console.log(`[Adsgram] [${i + 1}/${blockIds.length}] blockId: ${bid}${cfg.debug ? " (debug)" : ""}`);
      const ok = await triggerAdgram(bid, cfg.debug || false);
      if (ok) anyOk = true;
      else console.warn(`[Adsgram] blockId ${bid} failed, continuing...`);
    }
    return anyOk;
  };

  const triggerMontag = async (zoneId: string): Promise<boolean> => {
    if (!zoneId) return false;

    const candidates = [
      `show_${zoneId}`,
      `monetag_${zoneId}`,
      "show_ad",
      "invokeAdUnit",
      "_monetag_show",
      "montag_show",
    ];

    for (const fnName of candidates) {
      if (typeof window[fnName] === "function") {
        try {
          await window[fnName](zoneId);
          console.log(`[Monetag] triggered via ${fnName}`);
          return true;
        } catch (e) {
          console.warn(`[Monetag] ${fnName} failed:`, e);
        }
      }
    }

    console.warn("[Monetag] No callable trigger found — using timer wait instead");
    return false;
  };

  const triggerCustom = async (zoneId: string): Promise<boolean> => {
    if (!zoneId) return false;
    if (typeof window[zoneId] === "function") {
      try {
        await window[zoneId]();
        return true;
      } catch (e) {
        console.warn("[Custom] function failed:", e);
      }
    }
    if (typeof window.show_ad === "function") {
      try {
        await window.show_ad(zoneId);
        return true;
      } catch (e) {
        console.warn("[Custom] show_ad failed:", e);
      }
    }
    return false;
  };

  const timerFallback = async (seconds?: number): Promise<boolean> => {
    const secs = seconds ?? adsConfig.duration_seconds ?? 15;
    await new Promise<void>((resolve) => setTimeout(resolve, secs * 1000));
    return true;
  };

  const triggerAd = async (slot: AdSlot): Promise<boolean> => {
    const platform = getPlatform(slot);

    if (platform === "none") {
      return await timerFallback();
    }

    if (platform === "adgram") {
      const cfg = platforms.adgram;
      if (cfg?.enabled) {
        console.log("[Ads] Adgram → triggering all block IDs...");
        const ok = await triggerAllAdgram(cfg);
        if (ok) return true;
      }
      return await timerFallback();
    }

    if (platform === "montag") {
      const cfg = platforms.montag;
      if (cfg?.enabled && cfg.zone_id) {
        console.log("[Ads] Monetag → zoneId:", cfg.zone_id);
        const ok = await triggerMontag(cfg.zone_id);
        if (ok) return true;
      }
      return await timerFallback();
    }

    if (platform === "custom") {
      const cfg = platforms.custom;
      if (cfg?.enabled && cfg.zone_id) {
        const ok = await triggerCustom(cfg.zone_id);
        if (ok) return true;
      }
      return await timerFallback();
    }

    if (platform === "all") {
      let totalShown = 0;

      const adgramCfg = platforms.adgram;
      if (adgramCfg?.enabled) {
        const ids = getAllBlockIds(adgramCfg);
        if (ids.length > 0) {
          console.log(`[Ads] Adgram → triggering ${ids.length} block ID(s) in sequence...`);
          const ok = await triggerAllAdgram(adgramCfg);
          if (ok) totalShown++;
          else console.warn("[Ads] All Adgram block IDs failed, continuing to Monetag...");
        }
      }

      const montagCfg = platforms.montag;
      if (montagCfg?.enabled && montagCfg.zone_id) {
        console.log("[Ads] Monetag → zoneId:", montagCfg.zone_id);
        const ok = await triggerMontag(montagCfg.zone_id);
        if (ok) {
          totalShown++;
          console.log("[Ads] Monetag triggered successfully");
        } else {
          console.warn("[Ads] Monetag JS trigger not found — waiting timer for Monetag slot");
          await timerFallback(adsConfig.duration_seconds || 15);
          totalShown++;
        }
      }

      if (totalShown === 0) {
        console.warn("[Ads] No platform ran — using timer fallback");
        return await timerFallback();
      }

      return true;
    }

    return await timerFallback();
  };

  const isConfigured = (slot: AdSlot): boolean => {
    const platform = getPlatform(slot);
    return platform !== "none";
  };

  return { triggerAd, isConfigured, getPlatform, adsConfig };
}
