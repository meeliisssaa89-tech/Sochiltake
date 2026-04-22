import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Gift } from "lucide-react";
import { hapticImpact, hapticNotification, hapticSelection } from "@/lib/telegram";
import { useAdTrigger } from "@/hooks/useAdTrigger";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const ITEM_W = 96;
const IDLE_SPEED = 0.45;
const FAST_SPEED = 24;
const REPEAT = 80;
const DECEL_MS = 4500;
const MIN_FAST_MS = 1600;

interface Prize {
  id: string;
  label: string;
  image_url: string | null;
  amount: number;
  currency_id: string | null;
  xp_reward: number;
  weight: number;
}

export function SpinWheel() {
  const { user, refreshUser } = useUser();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Animation state refs (non-React, for rAF)
  const isSpinningRef = useRef(false);
  const offsetRef = useRef(0);
  const speedRef = useRef(IDLE_SPEED);
  const lastCrossedRef = useRef(-1);
  const decelRef = useRef<{ start: number; from: number; to: number } | null>(null);
  const onDecelDoneRef = useRef<(() => void) | null>(null);

  // React state
  const [displayOffset, setDisplayOffset] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonLabel, setWonLabel] = useState<string | null>(null);

  const { triggerAd, isConfigured } = useAdTrigger();
  const spinNeedsAd = isConfigured("spin_button");

  const { data: prizes = [] } = useQuery<Prize[]>({
    queryKey: ["spin-prizes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spin_prizes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: spinConfig } = useQuery<{ free_spins_per_day: number; enabled: boolean }>({
    queryKey: ["spin-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "spin_config")
        .maybeSingle();
      return (data?.value as any) || { free_spins_per_day: 3, enabled: true };
    },
  });

  const { data: spinsUsedToday = 0, refetch: refetchSpins } = useQuery<number>({
    queryKey: ["spins-today", user?.telegram_id],
    queryFn: async () => {
      if (!user?.telegram_id) return 0;
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("spin_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.telegram_id)
        .eq("spin_date", today);
      return count || 0;
    },
    enabled: !!user?.telegram_id,
  });

  const maxSpins = spinConfig?.free_spins_per_day ?? 3;
  const spinsLeft = Math.max(0, maxSpins - spinsUsedToday);
  const totalWidth = prizes.length * ITEM_W;
  const totalStripWidth = REPEAT * ITEM_W;
  const stripItems: Prize[] = prizes.length > 0
    ? Array.from({ length: REPEAT }, (_, i) => prizes[i % prizes.length])
    : [];
  const totalWeight = prizes.reduce((s, p) => s + (p.weight || 1), 0);

  // Single rAF loop
  useEffect(() => {
    if (prizes.length === 0) return;

    const tick = (now: number) => {
      const dcl = decelRef.current;

      if (dcl) {
        // Decel phase: ease-out cubic from start to target
        const elapsed = now - dcl.start;
        const progress = Math.min(elapsed / DECEL_MS, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        offsetRef.current = dcl.from + (dcl.to - dcl.from) * eased;

        // Haptic ticks (slow down as we approach target)
        if (progress < 0.9) {
          const idx = Math.floor(offsetRef.current / ITEM_W);
          if (idx !== lastCrossedRef.current) {
            lastCrossedRef.current = idx;
            hapticSelection();
          }
        }

        setDisplayOffset(offsetRef.current);

        if (progress >= 1) {
          decelRef.current = null;
          if (onDecelDoneRef.current) {
            onDecelDoneRef.current();
            onDecelDoneRef.current = null;
          }
          // Resume idle
          offsetRef.current = offsetRef.current % totalWidth;
          isSpinningRef.current = false;
          speedRef.current = IDLE_SPEED;
          lastCrossedRef.current = -1;
        }
      } else if (isSpinningRef.current) {
        // Fast spin phase
        speedRef.current = Math.min(speedRef.current + 0.9, FAST_SPEED);
        offsetRef.current += speedRef.current;
        if (offsetRef.current >= totalStripWidth) offsetRef.current -= totalStripWidth;

        const idx = Math.floor(offsetRef.current / ITEM_W);
        if (idx !== lastCrossedRef.current) {
          lastCrossedRef.current = idx;
          hapticSelection();
        }
        setDisplayOffset(offsetRef.current);
      } else {
        // Idle phase
        offsetRef.current += IDLE_SPEED;
        if (offsetRef.current >= totalWidth) offsetRef.current -= totalWidth;
        setDisplayOffset(offsetRef.current);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [prizes.length, totalWidth, totalStripWidth]);

  const triggerDecel = useCallback((prize: Prize, onDone: () => void) => {
    const prizeIndex = prizes.findIndex((p) => p.id === prize.id);
    const containerWidth = stripRef.current?.offsetWidth || 360;
    const centerPx = Math.floor(containerWidth / 2) - Math.floor(ITEM_W / 2);

    const currOff = offsetRef.current;
    // Find a landing offset that puts prize in center, at least MIN_FAST_MS worth of distance ahead
    const minDistance = FAST_SPEED * (MIN_FAST_MS / 16.67) * 0.5;
    let targetOff = prizeIndex * ITEM_W - centerPx;
    while (targetOff < currOff + minDistance) {
      targetOff += prizes.length * ITEM_W;
    }

    decelRef.current = { start: performance.now(), from: currOff, to: targetOff };
    onDecelDoneRef.current = onDone;
    hapticImpact("heavy");
  }, [prizes]);

  const handleSpin = async () => {
    if (!user?.telegram_id || isSpinning || isSpinningRef.current) return;
    if (spinsLeft <= 0) {
      toast({ title: t("error"), description: "No spins left today", variant: "destructive" });
      return;
    }

    hapticImpact("heavy");
    setIsSpinning(true);
    setWonLabel(null);

    try {
      // Step 1: Show ad FIRST (wait for completion)
      if (spinNeedsAd) {
        await triggerAd("spin_button");
      }

      // Step 2: Start fast spinning (AFTER ad)
      isSpinningRef.current = true;
      speedRef.current = IDLE_SPEED;
      lastCrossedRef.current = -1;
      const spinStart = performance.now();

      // Step 3: Call API
      const res = await fetch(`${SUPABASE_URL}/functions/v1/spin-wheel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ userId: user.telegram_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Spin failed");

      // Step 4: Ensure we've spun at least MIN_FAST_MS before decelerating
      const fastElapsed = performance.now() - spinStart;
      if (fastElapsed < MIN_FAST_MS) {
        await new Promise((r) => setTimeout(r, MIN_FAST_MS - fastElapsed));
      }

      // Step 5: Decelerate to the prize
      const prize: Prize = data.prize;
      triggerDecel(prize, () => {
        // Called when decel completes
        setWonLabel(prize.label);
        hapticNotification("success");
        toast({
          title: `🎉 ${prize.label}`,
          description: prize.amount > 0 ? `+${prize.amount}` : "Better luck next time!",
        });
        refreshUser();
        qc.invalidateQueries({ queryKey: ["balances"] });
        refetchSpins();
        setIsSpinning(false);

        setTimeout(() => setWonLabel(null), 2500);
      });
    } catch (err: any) {
      hapticNotification("error");
      toast({ title: t("error"), description: err.message, variant: "destructive" });
      isSpinningRef.current = false;
      decelRef.current = null;
      speedRef.current = IDLE_SPEED;
      setIsSpinning(false);
    }
  };

  if (prizes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass-card rounded-2xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gift className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("spinAndWin")}</h3>
            <p className="text-[10px] text-muted-foreground">{t("spinDesc")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">{t("spinsLeft")}</p>
            <p className={`text-sm font-bold tabular-nums leading-none ${spinsLeft === 0 ? "text-destructive" : "text-accent"}`}>
              {spinsLeft}/{maxSpins}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSpin}
            disabled={isSpinning || spinsLeft === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 text-xs font-semibold px-4 disabled:opacity-50"
            data-testid="button-spin-wheel"
          >
            {isSpinning
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><Sparkles className="w-3 h-3 me-1" />{t("spin")}</>
            }
          </Button>
        </div>
      </div>

      {/* Strip */}
      <div
        ref={stripRef}
        className="relative h-24 overflow-hidden rounded-xl bg-secondary/40 border border-border"
      >
        {/* Center indicator */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-accent z-20 -translate-x-1/2 shadow-[0_0_14px_hsl(var(--accent))]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-accent" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[9px] border-b-accent" />
        </div>

        {/* Scrolling items */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ transform: `translateX(-${displayOffset}px)`, willChange: "transform" }}
        >
          {stripItems.map((p, i) => {
            const isWon = wonLabel === p.label;
            return (
              <div
                key={`${p.id}-${i}`}
                className={`w-24 h-full flex flex-col items-center justify-center shrink-0 px-1 border-r border-border/30 transition-colors duration-300 ${isWon ? "bg-accent/20" : ""}`}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.label} className="w-10 h-10 object-contain" />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isWon ? "bg-accent/40" : "bg-accent/20"}`}>
                    <Sparkles className={`w-5 h-5 ${isWon ? "text-accent" : "text-accent/60"}`} />
                  </div>
                )}
                <p className="text-[10px] font-semibold text-center mt-1 truncate w-full px-1">{p.label}</p>
              </div>
            );
          })}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-secondary to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-secondary to-transparent z-10 pointer-events-none" />
      </div>

      {/* Prize probabilities */}
      {prizes.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1">
          {prizes.map((p) => {
            const pct = totalWeight > 0 ? ((p.weight || 1) / totalWeight * 100).toFixed(0) : "0";
            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-secondary/50 text-[10px] gap-1"
              >
                <span className="truncate text-foreground/80 flex-1">{p.label}</span>
                {p.amount > 0 && (
                  <span className="text-muted-foreground shrink-0">+{p.amount}</span>
                )}
                <span className="text-accent font-bold shrink-0">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
