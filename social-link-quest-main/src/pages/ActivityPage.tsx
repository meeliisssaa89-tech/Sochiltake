import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import {
  useUserTasks, useReferrals, useCheckinStatus, useAppSettings,
  useAdsToday, useActivityFeed, useTasks,
} from "@/hooks/useSupabaseData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Users, Target, Eye, Award, Zap,
  Gift, Repeat2, Star, LayoutList, Trophy, Flame, ExternalLink,
  MessageSquare, Twitter, Instagram, Globe,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

const FEED_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  task_completion: { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-400/10"  },
  referral:        { icon: Users,         color: "text-blue-400",   bg: "bg-blue-400/10"   },
  ad_watched:      { icon: Eye,           color: "text-primary",    bg: "bg-primary/10"    },
  spin:            { icon: Repeat2,       color: "text-accent",     bg: "bg-accent/10"     },
  checkin:         { icon: Target,        color: "text-orange-400", bg: "bg-orange-400/10" },
  promo_redeemed:  { icon: Gift,          color: "text-purple-400", bg: "bg-purple-400/10" },
  spin_win:        { icon: Star,          color: "text-yellow-400", bg: "bg-yellow-400/10" },
  default:         { icon: Award,         color: "text-primary",    bg: "bg-primary/10"    },
};

const TASK_TYPE_ICONS: Record<string, any> = {
  telegram: MessageSquare,
  twitter:  Twitter,
  instagram: Instagram,
  default:  Globe,
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
  { id: "2", title_en: "Streak Master",  title_ar: "ملك السلاسل",   desc_en: "30-day check-in streak",desc_ar: "سلسلة 30 يوم",    goal_type: "checkin_streak",  goal_value: 30,  reward_label: "2 USDT",     is_active: true },
  { id: "3", title_en: "Top Referrer",   title_ar: "أفضل مُحيل",    desc_en: "Invite 20 friends",    desc_ar: "ادعُ 20 صديقاً",  goal_type: "referrals",       goal_value: 20,  reward_label: "5 USDT",     is_active: true },
  { id: "4", title_en: "Task Champion",  title_ar: "بطل المهام",    desc_en: "Complete 50 tasks",    desc_ar: "أكمل 50 مهمة",     goal_type: "tasks_completed", goal_value: 50,  reward_label: "10 USDT",    is_active: true },
  { id: "5", title_en: "Ad Watcher",     title_ar: "مشاهد الإعلانات",desc_en: "Watch 100 ads",       desc_ar: "شاهد 100 إعلان",  goal_type: "ads_watched",     goal_value: 100, reward_label: "1 USDT",     is_active: true },
];

export function ActivityPage() {
  const { t, language } = useLanguage();
  const { user } = useUser();
  const [tab, setTab] = useState<"missions" | "feed" | "achievements">("missions");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");

  const { data: allTasks = [], isLoading: tasksLoading } = useTasks();
  const { data: userTasks }    = useUserTasks(user?.telegram_id);
  const { data: referralData } = useReferrals(user?.telegram_id);
  const { data: checkinData }  = useCheckinStatus(user?.telegram_id);
  const { data: settings }     = useAppSettings();
  const { data: adsToday }     = useAdsToday(user?.telegram_id);
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

  const completedIds = new Set((userTasks || []).filter((ut) => ut.status === "completed").map((ut) => ut.task_id));

  const activeTasks = (allTasks as any[]).filter((tk) => tk.is_active);
  const taskTypes = ["all", ...Array.from(new Set(activeTasks.map((tk) => tk.task_type || "other").filter(Boolean)))];
  const filteredTasks = taskTypeFilter === "all" ? activeTasks : activeTasks.filter((tk) => (tk.task_type || "other") === taskTypeFilter);
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const aDone = completedIds.has(a.id) ? 1 : 0;
    const bDone = completedIds.has(b.id) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (Number(b.reward_amount) || 0) - (Number(a.reward_amount) || 0);
  });

  const TON_ICON = "https://ton.org/icons/ton_symbol.svg";
  const USDT_ICON = "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040";

  const tabs = [
    { id: "missions" as const,      icon: Flame,      label: "Missions" },
    { id: "feed" as const,          icon: LayoutList,  label: t("activityFeed") },
    { id: "achievements" as const,  icon: Trophy,      label: t("achievements") },
  ];

  return (
    <div className="space-y-3 pb-4">
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-accent">{completedCount}</p>
          <p className="text-[9px] text-muted-foreground">{t("tasksCompleted")}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-primary">{streak}</p>
          <p className="text-[9px] text-muted-foreground">{t("streak")}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-yellow-400">{referralCount}</p>
          <p className="text-[9px] text-muted-foreground">{t("referrals")}</p>
        </div>
      </div>

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
        {/* ── Missions Tab ── */}
        {tab === "missions" && (
          <motion.div key="missions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {/* Type filter chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {taskTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setTaskTypeFilter(type)}
                  className={`flex-none px-3 py-1 rounded-full text-[10px] font-medium transition-all border capitalize ${
                    taskTypeFilter === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {type === "all" ? t("allTasks") : type}
                </button>
              ))}
            </div>

            {tasksLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : sortedTasks.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Flame className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("noData")}</p>
              </div>
            ) : (
              sortedTasks.map((task: any, i: number) => {
                const isDone = completedIds.has(task.id);
                const TypeIcon = TASK_TYPE_ICONS[task.task_type] || TASK_TYPE_ICONS.default;
                const cur = task.currencies;
                const iconUrl = cur?.icon_url || (cur?.symbol === "TON" ? TON_ICON : cur?.symbol === "USDT" ? USDT_ICON : null);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`glass-card rounded-xl p-3 flex items-start gap-3 ${isDone ? "opacity-60" : ""}`}
                    data-testid={`mission-card-${task.id}`}
                  >
                    {/* Type icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDone ? "bg-success/10" : "bg-primary/10"}`}>
                      {isDone
                        ? <CheckCircle2 className="w-5 h-5 text-success" />
                        : <TypeIcon className="w-5 h-5 text-primary" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{language === "ar" && task.title_ar ? task.title_ar : task.title}</p>
                          {task.description && (
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                              {language === "ar" && task.description_ar ? task.description_ar : task.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {iconUrl ? (
                            <img src={iconUrl} alt={cur?.symbol} className="w-3.5 h-3.5 rounded-full object-contain" />
                          ) : null}
                          <span className="text-xs font-bold text-accent">+{task.reward_amount}</span>
                          {task.xp_reward > 0 && (
                            <span className="text-[9px] text-primary">+{task.xp_reward} XP</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] capitalize border-0 ${
                            task.task_type === "telegram" ? "bg-blue-400/10 text-blue-400" :
                            task.task_type === "twitter"  ? "bg-sky-400/10 text-sky-400" :
                            "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {task.task_type || "other"}
                        </Badge>
                        {isDone ? (
                          <Badge className="bg-success/10 text-success border-0 text-[9px]">{t("completed")}</Badge>
                        ) : task.is_required ? (
                          <Badge className="bg-destructive/10 text-destructive border-0 text-[9px]">{t("required")}</Badge>
                        ) : null}
                        {task.url && !isDone && (
                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-0.5 text-[10px] text-primary hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Go
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

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
            {achievements.map((ach, i) => {
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
                      {done ? <Zap className="w-5 h-5 text-accent" /> : <Icon className="w-5 h-5 text-primary" />}
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
            })}
            {achievements.length === 0 && (
              <div className="glass-card rounded-xl p-6 text-center">
                <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{t("noData")}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
