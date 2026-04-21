import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import {
  useUserTasks, useReferrals, useCheckinStatus, useAppSettings,
  useAdsToday, useActivityFeed,
} from "@/hooks/useSupabaseData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Users, Target, Eye, Award, Zap, TrendingUp,
  Gift, Repeat2, Star, LayoutList, Trophy, BarChart3,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

const FEED_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  task_completion: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
  referral:        { icon: Users,         color: "text-blue-400",  bg: "bg-blue-400/10"  },
  ad_watched:      { icon: Eye,           color: "text-primary",   bg: "bg-primary/10"   },
  spin:            { icon: Repeat2,       color: "text-accent",    bg: "bg-accent/10"    },
  checkin:         { icon: Target,        color: "text-orange-400",bg: "bg-orange-400/10"},
  promo_redeemed:  { icon: Gift,          color: "text-purple-400",bg: "bg-purple-400/10"},
  spin_win:        { icon: Star,          color: "text-yellow-400",bg: "bg-yellow-400/10"},
  default:         { icon: Award,         color: "text-primary",   bg: "bg-primary/10"   },
};

const ACH_ICONS: Record<string, any> = {
  tasks_completed: CheckCircle2,
  referrals:       Users,
  checkin_streak:  Target,
  ads_watched:     Eye,
  default:         Award,
};

interface Achievement {
  id: string;
  title_en: string; title_ar: string;
  desc_en: string;  desc_ar: string;
  goal_type: string; goal_value: number;
  reward_label: string; is_active: boolean;
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: "1", title_en: "Early Bird",     title_ar: "الطائر المبكر", desc_en: "Complete 10 tasks",    desc_ar: "أكمل 10 مهام",      goal_type: "tasks_completed", goal_value: 10,  reward_label: "0.5 USDT",   is_active: true },
  { id: "2", title_en: "Streak Master",  title_ar: "ملك السلاسل",   desc_en: "30-day check-in streak",desc_ar: "سلسلة 30 يوم",     goal_type: "checkin_streak",  goal_value: 30,  reward_label: "2 USDT",     is_active: true },
  { id: "3", title_en: "Top Referrer",   title_ar: "أفضل مُحيل",    desc_en: "Invite 20 friends",    desc_ar: "ادعُ 20 صديقاً",   goal_type: "referrals",       goal_value: 20,  reward_label: "5 USDT",     is_active: true },
  { id: "4", title_en: "Task Champion",  title_ar: "بطل المهام",    desc_en: "Complete 50 tasks",    desc_ar: "أكمل 50 مهمة",      goal_type: "tasks_completed", goal_value: 50,  reward_label: "10 USDT",    is_active: true },
  { id: "5", title_en: "Ad Watcher",     title_ar: "مشاهد الإعلانات",desc_en: "Watch 100 ads",       desc_ar: "شاهد 100 إعلان",   goal_type: "ads_watched",     goal_value: 100, reward_label: "1 USDT",     is_active: true },
];

export function ActivityPage() {
  const { t, language } = useLanguage();
  const { user, balances } = useUser();
  const [tab, setTab] = useState<"feed" | "achievements" | "stats">("feed");

  const { data: userTasks,   isLoading: tasksLoading } = useUserTasks(user?.telegram_id);
  const { data: referralData }  = useReferrals(user?.telegram_id);
  const { data: checkinData }   = useCheckinStatus(user?.telegram_id);
  const { data: settings }      = useAppSettings();
  const { data: adsToday }      = useAdsToday(user?.telegram_id);
  const { data: feedItems = [], isLoading: feedLoading } = useActivityFeed(user?.telegram_id, 50);

  const completedCount = userTasks?.filter((ut) => ut.status === "completed").length || 0;
  const adsWatched     = adsToday?.length || 0;
  const streak         = checkinData?.streak || 0;
  const referralCount  = referralData?.count || 0;

  const rawAchievements = settings?.activity_achievements;
  const achievements: Achievement[] = Array.isArray(rawAchievements) && rawAchievements.length > 0
    ? (rawAchievements as Achievement[]).filter((a) => a.is_active)
    : DEFAULT_ACHIEVEMENTS;

  const getProgress = (ach: Achievement): number => {
    let current = 0;
    if      (ach.goal_type === "tasks_completed") current = completedCount;
    else if (ach.goal_type === "referrals")       current = referralCount;
    else if (ach.goal_type === "checkin_streak")  current = streak;
    else if (ach.goal_type === "ads_watched")     current = adsWatched;
    return Math.min((current / Math.max(ach.goal_value, 1)) * 100, 100);
  };

  const getCurrent = (ach: Achievement): number => {
    if      (ach.goal_type === "tasks_completed") return completedCount;
    else if (ach.goal_type === "referrals")       return referralCount;
    else if (ach.goal_type === "checkin_streak")  return streak;
    else if (ach.goal_type === "ads_watched")     return adsWatched;
    return 0;
  };

  const totalBalance = balances.reduce((s, b) => s + Number(b.amount || 0), 0);

  const tabs = [
    { id: "feed" as const, icon: LayoutList, label: t("activityFeed") },
    { id: "achievements" as const, icon: Trophy, label: t("achievements") },
    { id: "stats" as const, icon: BarChart3, label: t("stats") },
  ];

  return (
    <div className="space-y-3 pb-4">
      {/* Tab bar */}
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === tb.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <tb.icon className="w-3 h-3" />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── Activity Feed ── */}
        {tab === "feed" && (
          <motion.div key="feed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            {feedLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : feedItems.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <LayoutList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("noFeedData")}</p>
              </div>
            ) : (
              feedItems.map((item: any, i: number) => {
                const cfg = FEED_ICONS[item.type] || FEED_ICONS.default;
                const Icon = cfg.icon;
                const time = formatDistanceToNow(new Date(item.created_at), {
                  addSuffix: true,
                  locale: language === "ar" ? ar : enUS,
                });
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass-card rounded-xl p-3 flex items-center gap-3"
                    data-testid={`feed-item-${item.id}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{time}</p>
                    </div>
                    {item.meta?.reward && (
                      <Badge variant="outline" className="text-[9px] shrink-0 border-accent/30 text-accent">
                        +{item.meta.reward}
                      </Badge>
                    )}
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {/* ── Achievements ── */}
        {tab === "achievements" && (
          <motion.div key="ach" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            {tasksLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
            ) : (
              achievements.map((ach, i) => {
                const progress = getProgress(ach);
                const current  = getCurrent(ach);
                const done     = progress >= 100;
                const Icon     = ACH_ICONS[ach.goal_type] || ACH_ICONS.default;
                const title    = language === "ar" && ach.title_ar ? ach.title_ar : ach.title_en;
                const desc     = language === "ar" && ach.desc_ar  ? ach.desc_ar  : ach.desc_en;
                return (
                  <motion.div
                    key={ach.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className={`glass-card rounded-xl p-3 ${done ? "border border-accent/30" : ""}`}
                    data-testid={`achievement-${ach.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${done ? "bg-accent/20" : "bg-primary/10"}`}>
                        {done
                          ? <Zap className="w-5 h-5 text-accent" />
                          : <Icon className="w-5 h-5 text-primary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{title}</p>
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${done ? "border-accent/30 text-accent" : "border-border"}`}>
                            {ach.reward_label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {current}/{ach.goal_value}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
            {achievements.length === 0 && (
              <div className="glass-card rounded-xl p-6 text-center">
                <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{t("noData")}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Stats ── */}
        {tab === "stats" && (
          <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            {[
              { icon: TrendingUp, label: t("totalBalance"),    value: totalBalance.toLocaleString(), sub: balances[0]?.currencies?.symbol || "USDT", color: "text-accent",    pct: Math.min((totalBalance / 100) * 100, 100) },
              { icon: CheckCircle2, label: t("tasksCompleted"),value: String(completedCount),         sub: "/ 100", color: "text-primary",  pct: Math.min((completedCount / 100) * 100, 100) },
              { icon: Users,       label: t("referrals"),      value: String(referralCount),          sub: t("friends"), color: "text-blue-400", pct: Math.min((referralCount / 50) * 100, 100) },
              { icon: Target,      label: t("streak"),         value: String(streak),                 sub: t("days"),    color: "text-orange-400", pct: Math.min((streak / 30) * 100, 100) },
              { icon: Eye,         label: t("dailyAds"),       value: String(adsWatched),             sub: t("adsToday"), color: "text-primary", pct: Math.min((adsWatched / 10) * 100, 100) },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="glass-card rounded-xl p-3"
                data-testid={`stat-card-${i}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                    <span className="text-xs text-muted-foreground">{card.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-bold tabular-nums ${card.color}`}>{card.value}</span>
                    <span className="text-[10px] text-muted-foreground">{card.sub}</span>
                  </div>
                </div>
                <Progress value={card.pct} className="h-1.5" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
