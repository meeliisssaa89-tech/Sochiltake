import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, Loader2, Coins, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdsToday, useWatchAd, useCurrencies } from "@/hooks/useSupabaseData";
import { useAdTrigger } from "@/hooks/useAdTrigger";
import { hapticImpact, hapticNotification } from "@/lib/telegram";

export function DailyAdsCard() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();
  const userId = user?.telegram_id;

  const { triggerAd, isConfigured, adsConfig } = useAdTrigger();
  const { data: currencies } = useCurrencies();
  const { data: watchedToday = [] } = useAdsToday(userId);
  const watchMutation = useWatchAd();

  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (!adsConfig.enabled) return null;

  const watchedCount = (watchedToday as any[]).length;
  const remaining = Math.max(0, adsConfig.daily_count - watchedCount);
  const allDone = remaining === 0;

  const getCurrencySymbol = () => {
    const sym = adsConfig.reward_currency_symbol;
    if (sym) return sym;
    if (currencies && currencies.length > 0) return currencies[0].symbol;
    return "TON";
  };
  const currencySymbol = getCurrencySymbol();

  const handleWatch = async () => {
    if (!userId || allDone || watching) return;
    hapticImpact("medium");
    setWatching(true);

    try {
      if (isConfigured("daily_ads")) {
        await triggerAd("daily_ads");
      } else {
        setCountdown(adsConfig.duration_seconds || 15);
        await new Promise<void>((resolve) => {
          const iv = window.setInterval(() => {
            setCountdown((c) => {
              if (c <= 1) { window.clearInterval(iv); resolve(); return 0; }
              return c - 1;
            });
          }, 1000);
        });
      }

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

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(adsConfig.daily_count || 10, 10)}, minmax(0,1fr))` }}
      >
        {Array.from({ length: adsConfig.daily_count || 10 }).map((_, i) => {
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
        {watchedCount}/{adsConfig.daily_count || 10} · {t("nextReset")}
      </p>
    </motion.div>
  );
}
