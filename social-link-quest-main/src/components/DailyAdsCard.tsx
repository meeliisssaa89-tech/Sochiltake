import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Eye, Loader2, Coins, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings, useAdsToday, useWatchAd } from "@/hooks/useSupabaseData";
import { hapticImpact, hapticNotification } from "@/lib/telegram";

interface AdsConfig {
  daily_count: number;
  reward_per_ad: number;
  xp_per_ad: number;
  duration_seconds: number;
  enabled: boolean;
}

declare global {
  interface Window {
    show_ad?: (zoneId?: string) => Promise<void>;
    [k: string]: any;
  }
}

export function DailyAdsCard() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();
  const userId = user?.telegram_id;

  const { data: settings } = useAppSettings();
  const adsConfig: AdsConfig = settings?.ads_daily || {
    daily_count: 10,
    reward_per_ad: 10,
    xp_per_ad: 5,
    duration_seconds: 15,
    enabled: true,
  };
  const adZone = (settings?.ads_zones as any)?.daily_ad_zone || "";
  const currencySymbol = (settings?.reward_currency_symbol as string) || "PTS";

  const { data: watchedToday = [] } = useAdsToday(userId);
  const watchMutation = useWatchAd();

  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  if (!adsConfig.enabled) return null;

  const watchedCount = watchedToday.length;
  const remaining = Math.max(0, adsConfig.daily_count - watchedCount);
  const allDone = remaining === 0;

  const triggerSdkAd = async (): Promise<boolean> => {
    if (typeof window.show_ad === "function") {
      try {
        await window.show_ad(adZone || undefined);
        return true;
      } catch (e) {
        console.warn("SDK ad failed", e);
        return false;
      }
    }
    return false;
  };

  const handleWatch = async () => {
    if (!userId || allDone || watching) return;
    hapticImpact("medium");
    setWatching(true);

    // Try SDK ad first
    const sdkOk = await triggerSdkAd();

    // Fall back to internal countdown timer if no SDK or it failed
    if (!sdkOk) {
      setCountdown(adsConfig.duration_seconds);
      await new Promise<void>((resolve) => {
        timerRef.current = window.setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) {
              if (timerRef.current) window.clearInterval(timerRef.current);
              resolve();
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      });
    }

    try {
      const slotIndex = watchedCount;
      const result = await watchMutation.mutateAsync({ userId, slotIndex });
      hapticNotification("success");
      toast({
        title: t("success"),
        description: `+${result.reward} ${currencySymbol}, +${result.xp} XP`,
      });
    } catch (err: any) {
      hapticNotification("error");
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setWatching(false);
      setCountdown(0);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Eye className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("dailyAds")}</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Coins className="w-3 h-3 text-accent" />
              +{adsConfig.reward_per_ad} {currencySymbol} · +{adsConfig.xp_per_ad} XP
            </p>
          </div>
        </div>
        <Button
          size="sm"
          disabled={allDone || watching}
          onClick={handleWatch}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 text-xs font-semibold px-4 disabled:opacity-50"
        >
          {watching ? (
            countdown > 0 ? (
              <span className="tabular-nums">{countdown}s</span>
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )
          ) : allDone ? (
            t("allAdsWatched")
          ) : (
            <>
              <Play className="w-3 h-3 me-1 fill-current" />
              {t("watchAdNow")}
            </>
          )}
        </Button>
      </div>

      {/* Slots — exactly like daily check-in but per ad */}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(adsConfig.daily_count, 10)}, minmax(0,1fr))` }}>
        {Array.from({ length: adsConfig.daily_count }).map((_, i) => {
          const done = i < watchedCount;
          const next = i === watchedCount;
          return (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-colors ${
                done ? "bg-primary" : next ? "bg-primary/40 animate-pulse-glow" : "bg-secondary"
              }`}
            />
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {watchedCount}/{adsConfig.daily_count} · {t("nextReset")}
      </p>
    </motion.div>
  );
}
