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
  zone_id: string;
  sdk_html: string;
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

  const triggerAdgram = async (blockId: string): Promise<boolean> => {
    if (!blockId) return false;
    const sdk = window.Adsgram;
    if (!sdk) {
      console.warn("[Adsgram] SDK not loaded yet");
      return false;
    }
    try {
      const controller = sdk.init({ blockId });
      await controller.show();
      return true;
    } catch (err) {
      console.warn("[Adsgram] show failed:", err);
      return false;
    }
  };

  const triggerMontag = async (zoneId: string): Promise<boolean> => {
    if (!zoneId) return false;
    const fnName = `show_${zoneId}`;
    if (typeof window[fnName] === "function") {
      try { await window[fnName](); return true; } catch (e) { console.warn("[Monetag] function failed:", e); }
    }
    if (typeof window.show_ad === "function") {
      try { await window.show_ad(zoneId); return true; } catch (e) { console.warn("[Monetag] show_ad failed:", e); }
    }
    return false;
  };

  const triggerCustom = async (zoneId: string): Promise<boolean> => {
    if (!zoneId) return false;
    if (typeof window[zoneId] === "function") {
      try { await window[zoneId](); return true; } catch (e) { console.warn("[Custom] function failed:", e); }
    }
    if (typeof window.show_ad === "function") {
      try { await window.show_ad(zoneId); return true; } catch (e) { /* ignore */ }
    }
    return false;
  };

  const timerFallback = async (): Promise<boolean> => {
    const secs = adsConfig.duration_seconds || 15;
    await new Promise<void>((resolve) => setTimeout(resolve, secs * 1000));
    return true;
  };

  const triggerAd = async (slot: AdSlot): Promise<boolean> => {
    const platform = getPlatform(slot);
    if (platform === "none") return true;

    if (platform === "adgram") {
      const cfg = platforms.adgram;
      if (cfg?.enabled && cfg.block_id) {
        const ok = await triggerAdgram(cfg.block_id);
        if (ok) return true;
      }
    }

    if (platform === "montag") {
      const cfg = platforms.montag;
      if (cfg?.enabled && cfg.zone_id) {
        const ok = await triggerMontag(cfg.zone_id);
        if (ok) return true;
      }
    }

    if (platform === "custom") {
      const cfg = platforms.custom;
      if (cfg?.enabled && cfg.zone_id) {
        const ok = await triggerCustom(cfg.zone_id);
        if (ok) return true;
      }
    }

    return await timerFallback();
  };

  const isConfigured = (slot: AdSlot): boolean => {
    const platform = getPlatform(slot);
    return platform !== "none";
  };

  return { triggerAd, isConfigured, getPlatform, adsConfig };
}
