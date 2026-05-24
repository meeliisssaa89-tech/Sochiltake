import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Star, ExternalLink, Coins } from "lucide-react";
import { useAppSettings } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useLanguage } from "@/contexts/LanguageContext";

const POPUP_SHOWN_KEY = "popup_task_shown_at";
const MIN_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

export function PopupTaskModal() {
  const { data: settings } = useAppSettings();
  const { user } = useUser();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<any>(null);
  const [prizeWinner, setPrizeWinner] = useState<any>(null);

  useEffect(() => {
    if (!settings || !user?.telegram_id) return;

    const popupConfig = (settings as any).popup_tasks_config;
    if (!popupConfig?.enabled) return;

    const lastShown = Number(localStorage.getItem(POPUP_SHOWN_KEY) || "0");
    const now = Date.now();
    if (now - lastShown < MIN_INTERVAL_MS) return;

    const taskIds: string[] = Array.isArray(popupConfig.task_ids) ? popupConfig.task_ids : [];
    if (!taskIds.length) return;

    const randomId = taskIds[Math.floor(Math.random() * taskIds.length)];

    supabase
      .from("tasks")
      .select("*, currencies:reward_currency_id(symbol, icon_url)")
      .eq("id", randomId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setTask(data);

        // Check prize draw
        if (popupConfig.prize_draw_enabled && popupConfig.prize_description) {
          setPrizeWinner({
            prize: popupConfig.prize_description,
            draw_date: popupConfig.prize_draw_date || "",
          });
        }

        localStorage.setItem(POPUP_SHOWN_KEY, String(now));
        setTimeout(() => setOpen(true), 2500);
      });
  }, [settings, user?.telegram_id]);

  if (!task) return null;

  const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
  const description = language === "ar" && task.description_ar ? task.description_ar : (task.description_en || "");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{
              background: "rgba(10,6,25,0.98)",
              border: "1px solid rgba(139,92,246,0.3)",
              boxShadow: "0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)",
            }}
          >
            <div
              className="p-5 space-y-4"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(0,0,0,0) 60%)" }}
            >
              {/* Close */}
              <div className="flex justify-end">
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <X className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>

              {/* Icon */}
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)" }}
                >
                  {task.icon_url ? (
                    <img src={task.icon_url} alt="" className="w-14 h-14 object-cover rounded-2xl" />
                  ) : (
                    <Gift className="w-8 h-8 text-purple-400" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="text-center space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400/70">
                  {language === "ar" ? "عرض خاص" : "Special Offer"}
                </p>
                <h3 className="font-bold text-white text-lg leading-snug">{title}</h3>
                {description && (
                  <p className="text-sm text-white/50 leading-relaxed">{description}</p>
                )}
              </div>

              {/* Reward */}
              {(task.reward_amount > 0 || task.xp_reward > 0) && (
                <div
                  className="flex items-center justify-center gap-3 py-3 rounded-2xl"
                  style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}
                >
                  {task.reward_amount > 0 && (
                    <div className="flex items-center gap-1.5">
                      {task.currencies?.icon_url ? (
                        <img src={task.currencies.icon_url} alt="" className="w-5 h-5 rounded-full" />
                      ) : (
                        <Coins className="w-4 h-4 text-yellow-400" />
                      )}
                      <span className="text-base font-bold text-yellow-300">
                        +{task.reward_amount} {task.currencies?.symbol || ""}
                      </span>
                    </div>
                  )}
                  {task.xp_reward > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold text-purple-300">+{task.xp_reward} XP</span>
                    </div>
                  )}
                </div>
              )}

              {/* Prize Draw Banner */}
              {prizeWinner && (
                <div
                  className="p-3 rounded-2xl text-center"
                  style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)" }}
                >
                  <p className="text-[10px] font-semibold text-yellow-500/80 uppercase tracking-wider mb-1">
                    {language === "ar" ? "سحب الجائزة" : "Prize Draw"}
                  </p>
                  <p className="text-sm font-bold text-yellow-300">{prizeWinner.prize}</p>
                  {prizeWinner.draw_date && (
                    <p className="text-[10px] text-white/40 mt-0.5">{prizeWinner.draw_date}</p>
                  )}
                </div>
              )}

              {/* App Link Button */}
              {task.metadata?.app_link && (
                <a
                  href={task.metadata.app_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: "rgba(139,92,246,0.25)",
                    border: "1px solid rgba(139,92,246,0.45)",
                    color: "rgb(167,139,250)",
                    textDecoration: "none",
                    display: "flex",
                  }}
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="w-4 h-4" />
                  {task.metadata.app_link_label || (language === "ar" ? "افتح التطبيق" : "Open App")}
                </a>
              )}

              <button
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-2xl text-xs font-medium text-white/35 transition-all"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {language === "ar" ? "ربما لاحقاً" : "Maybe later"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
