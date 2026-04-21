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
const IDLE_SPEED = 0.5;
const SPIN_SPEED = 22;
const SPIN_DURATION_MS = 4000;
const REPEAT = 40;

interface Prize {
  id: string;
  label: string;
  image_url: string | null;
  amount: number;
  currency_id: string | null;
  xp_reward: number;
}

type Phase = "idle" | "accel" | "fast" | "decel" | "done";

export function SpinWheel() {
  const { user, refreshUser } = useUser();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const offsetRef = useRef(0);
  const speedRef = useRef(IDLE_SPEED);
  const [displayOffset, setDisplayOffset] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const lastItemRef = useRef(-1);
  const prizeResultRef = useRef<{ prize: Prize; spinsLeft: number } | null>(null);
  const spinStartMsRef = useRef(0);

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

  const totalWidth = prizes.length * ITEM_W;
  const stripItems: Prize[] = prizes.length > 0
    ? Array.from({ length: REPEAT }, (_, i) => prizes[i % prizes.length])
    : [];

  const fireHapticIfCrossed = useCallback((newOffset: number) => {
    if (phaseRef.current === "idle") return;
    const idx = Math.floor(newOffset / ITEM_W);
    if (idx !== lastItemRef.current) {
      lastItemRef.current = idx;
      hapticSelection();
    }
  }, []);

  useEffect(() => {
    if (prizes.length === 0) return;

    const tick = () => {
      const phase = phaseRef.current;

      if (phase === "idle") {
        offsetRef.current += IDLE_SPEED;
        if (offsetRef.current >= totalWidth) offsetRef.current -= totalWidth;

      } else if (phase === "accel") {
        speedRef.current = Math.min(speedRef.current + 0.6, SPIN_SPEED);
        offsetRef.current += speedRef.current;
        if (offsetRef.current >= REPEAT * ITEM_W) offsetRef.current -= REPEAT * ITEM_W;
        fireHapticIfCrossed(offsetRef.current);

        if (speedRef.current >= SPIN_SPEED) {
          phaseRef.current = "fast";
          spinStartMsRef.current = performance.now();
        }

      } else if (phase === "fast") {
        offsetRef.current += SPIN_SPEED;
        if (offsetRef.current >= REPEAT * ITEM_W) offsetRef.current -= REPEAT * ITEM_W;
        fireHapticIfCrossed(offsetRef.current);

        if (prizeResultRef.current && performance.now() - spinStartMsRef.current > 1200) {
          phaseRef.current = "decel";
          spinStartMsRef.current = performance.now();
        }

      } else if (phase === "decel") {
        const elapsed = performance.now() - spinStartMsRef.current;
        const progress = Math.min(elapsed / SPIN_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        speedRef.current = SPIN_SPEED * (1 - eased);

        offsetRef.current += Math.max(speedRef.current, 0.1);
        if (offsetRef.current >= REPEAT * ITEM_W) offsetRef.current -= REPEAT * ITEM_W;
        fireHapticIfCrossed(offsetRef.current);

        if (progress >= 1) {
          phaseRef.current = "done";

          const prize = prizeResultRef.current!.prize;
          const spinsLeft = prizeResultRef.current!.spinsLeft;
          const prizeIndex = prizes.findIndex((p) => p.id === prize.id);
          const containerWidth = stripRef.current?.offsetWidth || 360;
          const centerPx = Math.floor(containerWidth / 2) - Math.floor(ITEM_W / 2);

          const landingOffset = (prizeIndex * ITEM_W) + Math.floor(Math.random() * (ITEM_W - 20) + 10) - centerPx;
          const wrapped = ((landingOffset % (REPEAT * ITEM_W)) + REPEAT * ITEM_W) % (REPEAT * ITEM_W);
          offsetRef.current = wrapped;

          hapticNotification("success");
          toast({
            title: `🎉 ${prize.label}`,
            description: prize.amount > 0 ? `+${prize.amount} • ${t("spinsLeft")}: ${spinsLeft}` : `${t("spinsLeft")}: ${spinsLeft}`,
          });
          refreshUser();
          qc.invalidateQueries({ queryKey: ["balances"] });
          setIsSpinning(false);
          prizeResultRef.current = null;

          setTimeout(() => {
            phaseRef.current = "idle";
            speedRef.current = IDLE_SPEED;
            lastItemRef.current = -1;
          }, 1500);
        }
      }

      setDisplayOffset(offsetRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [prizes, totalWidth, fireHapticIfCrossed, refreshUser, qc, t, toast]);

  const handleSpin = async () => {
    if (!user?.telegram_id || isSpinning || phaseRef.current !== "idle") return;
    hapticImpact("heavy");
    setIsSpinning(true);
    prizeResultRef.current = null;
    lastItemRef.current = -1;
    speedRef.current = IDLE_SPEED;
    phaseRef.current = "accel";

    try {
      if (spinNeedsAd) await triggerAd("spin_button");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/spin-wheel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ userId: user.telegram_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Spin failed");

      prizeResultRef.current = { prize: data.prize, spinsLeft: data.spinsLeft };
    } catch (err: any) {
      hapticNotification("error");
      toast({ title: t("error"), description: err.message, variant: "destructive" });
      phaseRef.current = "idle";
      speedRef.current = IDLE_SPEED;
      prizeResultRef.current = null;
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
        <Button
          size="sm"
          onClick={handleSpin}
          disabled={isSpinning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 text-xs font-semibold px-4"
          data-testid="button-spin-wheel"
        >
          {isSpinning
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <><Sparkles className="w-3 h-3 me-1" /> {t("spin")}</>
          }
        </Button>
      </div>

      <div
        ref={stripRef}
        className="relative h-24 overflow-hidden rounded-xl bg-secondary/40 border border-border"
      >
        <div className="absolute left-1/2 top-0 bottom-0 w-[3px] bg-accent z-20 -translate-x-1/2 shadow-[0_0_14px_hsl(var(--accent))]">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[9px] border-t-accent" />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-b-[9px] border-b-accent" />
        </div>

        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ transform: `translateX(-${displayOffset}px)`, willChange: "transform" }}
        >
          {stripItems.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className="w-24 h-full flex flex-col items-center justify-center shrink-0 px-1 border-r border-border/30"
            >
              {p.image_url ? (
                <img src={p.image_url} alt={p.label} className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
              )}
              <p className="text-[10px] font-semibold text-center mt-1 truncate w-full px-1">{p.label}</p>
            </div>
          ))}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-secondary to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-secondary to-transparent z-10 pointer-events-none" />
      </div>
    </motion.div>
  );
}
