import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * Small green pulsing dot that flashes briefly whenever there's a relevant
 * realtime update for the current user (balance, completed task, activity entry).
 */
export function UpdateIndicator({ className = "" }: { className?: string }) {
  const { user } = useUser();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!user?.telegram_id) return;

    const trigger = () => {
      setActive(true);
      setTimeout(() => setActive(false), 2200);
    };

    const channel = supabase
      .channel(`updates-${user.telegram_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balances", filter: `user_id=eq.${user.telegram_id}` },
        trigger
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_tasks", filter: `user_id=eq.${user.telegram_id}` },
        trigger
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_feed", filter: `user_id=eq.${user.telegram_id}` },
        trigger
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.telegram_id]);

  return (
    <AnimatePresence>
      {active && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={`relative inline-flex h-2.5 w-2.5 ${className}`}
          aria-label="update"
        >
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_10px_hsl(var(--success))]" />
        </motion.span>
      )}
    </AnimatePresence>
  );
}
