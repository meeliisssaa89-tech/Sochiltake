import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Gift } from "lucide-react";
import { hapticImpact, hapticNotification } from "@/lib/telegram";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Prize {
  id: string;
  label: string;
  image_url: string | null;
  amount: number;
  currency_id: string | null;
  xp_reward: number;
}

export function SpinWheel() {
  const { user, refreshUser } = useUser();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isSpinning, setIsSpinning] = useState(false);
  const [offset, setOffset] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const speedRef = useRef(2); // px per frame

  const { data: prizes = [] } = useQuery<Prize[]>({
    queryKey: ["spin-prizes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("spin_prizes").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Repeat strip enough times so it can scroll seamlessly
  const stripItems = prizes.length > 0 ? Array.from({ length: 20 }, (_, i) => prizes[i % prizes.length]) : [];

  // Continuous scroll animation
  useEffect(() => {
    if (prizes.length === 0) return;
    const itemWidth = 96; // px
    const totalWidth = prizes.length * itemWidth;

    const tick = () => {
      setOffset((prev) => {
        let next = prev + speedRef.current;
        if (next >= totalWidth) next -= totalWidth;
        return next;
      });
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [prizes.length]);

  const spinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/spin-wheel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ userId: user?.telegram_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Spin failed");
      return data;
    },
  });

  const handleSpin = async () => {
    if (!user?.telegram_id || isSpinning) return;
    hapticImpact("medium");
    setIsSpinning(true);

    try {
      const result = await spinMutation.mutateAsync();
      const prize: Prize = result.prize;
      const itemWidth = 96;
      const totalWidth = prizes.length * itemWidth;
      const prizeIndex = prizes.findIndex((p) => p.id === prize.id);

      // Decelerate speed over ~3.5s, then snap final position so chosen prize lands under the line
      const startTime = performance.now();
      const duration = 3500;
      const startSpeed = speedRef.current;

      const decel = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        speedRef.current = startSpeed * (1 - t) ** 2;
        if (t < 1) {
          requestAnimationFrame(decel);
        } else {
          // Snap: compute current screen-center position, target = prizeIndex * itemWidth
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
          const containerWidth = stripRef.current?.offsetWidth || 360;
          const centerPx = containerWidth / 2 - itemWidth / 2;
          const targetOffset = ((prizeIndex * itemWidth) - centerPx + totalWidth * 5) % totalWidth;
          setOffset(targetOffset);

          hapticNotification("success");
          toast({ title: `🎉 ${prize.label}`, description: `Spins left: ${result.spinsLeft}` });
          refreshUser();
          qc.invalidateQueries({ queryKey: ["balances"] });
          setIsSpinning(false);
          // resume slow scroll after 1.5s
          setTimeout(() => {
            speedRef.current = 2;
            const tick = () => {
              setOffset((prev) => {
                let next = prev + speedRef.current;
                if (next >= totalWidth) next -= totalWidth;
                return next;
              });
              animationRef.current = requestAnimationFrame(tick);
            };
            animationRef.current = requestAnimationFrame(tick);
          }, 1500);
        }
      };
      // boost speed first
      speedRef.current = 18;
      requestAnimationFrame(decel);
    } catch (err: any) {
      hapticNotification("error");
      toast({ title: t("error"), description: err.message, variant: "destructive" });
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
            <h3 className="font-semibold text-sm">Spin & Win</h3>
            <p className="text-[10px] text-muted-foreground">Tap SPIN to win prizes</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSpin}
          disabled={isSpinning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 text-xs font-semibold px-4"
        >
          {isSpinning ? <Loader2 className="w-3 h-3 animate-spin" /> : (<><Sparkles className="w-3 h-3 me-1" /> SPIN</>)}
        </Button>
      </div>

      {/* Prize strip */}
      <div ref={stripRef} className="relative h-24 overflow-hidden rounded-xl bg-secondary/40 border border-border">
        {/* Vertical orange pointer line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-accent z-20 -translate-x-1/2 shadow-[0_0_12px_hsl(var(--accent))]">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-accent" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-accent" />
        </div>

        {/* Strip */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ transform: `translateX(-${offset}px)`, willChange: "transform" }}
        >
          {stripItems.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className="w-24 h-full flex flex-col items-center justify-center shrink-0 px-1 border-r border-border/40"
            >
              {p.image_url ? (
                <img src={p.image_url} alt={p.label} className="w-10 h-10 object-contain" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
              )}
              <p className="text-[10px] font-semibold text-center mt-1 truncate w-full">{p.label}</p>
            </div>
          ))}
        </div>

        {/* Edge fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-secondary to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-secondary to-transparent z-10 pointer-events-none" />
      </div>
    </motion.div>
  );
}
