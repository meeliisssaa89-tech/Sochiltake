import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import {
  useUserTasks, useReferrals, useCheckinStatus, useAppSettings,
  useAdsToday, useActivityFeed,
  useUserAchievements, useClaimAchievement,
} from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Users, Target, Eye, Award, Zap,
  Gift, Repeat2, Star, LayoutList, Trophy, Loader2, TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

const FEED_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  task_completion:      { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-400/10"  },
  referral:             { icon: Users,         color: "text-blue-400",   bg: "bg-blue-400/10"   },
  ad_watched:           { icon: Eye,           color: "text-primary",    bg: "bg-primary/10"    },
  spin:                 { icon: Repeat2,       color: "text-accent",     bg: "bg-accent/10"     },
  checkin:              { icon: Target,        color: "text-orange-400", bg: "bg-orange-400/10" },
  promo_redeemed:       { icon: Gift,          color: "text-purple-400", bg: "bg-purple-400/10" },
  spin_win:             { icon: Star,          color: "text-yellow-400", bg: "bg-yellow-400/10" },
  achievement_claimed:  { icon: Trophy,        color: "text-yellow-400", bg: "bg-yellow-400/10" },
  default:              { icon: Award,         color: "text-primary",    bg: "bg-primary/10"    },
};

const ACH_ICONS: Record<string, any> = {
  tasks_completed:   CheckCircle2,
  referrals:         Users,
  referral_ads:      Eye,
  referral_earnings: TrendingUp,
  checkin_streak:    Target,
  daily_logins:      Target,
  ads_watched:       Eye,
  level:             TrendingUp,
  spins:             Repeat2,
  default:           Award,
};

interface Achievement {
  id: string;
  title_en: string; title_ar: string;
  desc_en: string;  desc_ar: string;
  goal_type: string; goal_value: number;
  reward_label: string; is_active: boolean;
  reward_currency_id?: string | null;
  reward_amount?: number;
  xp_reward?: number;
}

export function ActivityPage() {
  const { t, language } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();
  const [tab, setTab] = useState<"achievements" | "feed" | "referrals">("achievements");

  const { data: userTasks }    = useUserTasks(user?.telegram_id);
  const { data: referralData } = useReferrals(user?.telegram_id);
  const { data: checkinData }  = useCheckinStatus(user?.telegram_id);
  const { data: settings }     = useAppSettings();
  const { data: adsToday }     = useAdsToday(user?.telegram_id);
  const { data: feedItems = [], isLoading: feedLoading } = useActivityFeed(user?.telegram_id, 50);
  const { data: claimed = [] } = useUserAchievements(user?.telegram_id);
  const claimMut = useClaimAchievement();

  // Currencies (so we can show the symbol on each achievement reward)
  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data } = await supabase.from("currencies").select("id, symbol, name, icon_url");
      return data || [];
    },
  });

  // Lifetime stats (for the goals — these go beyond "today")
  const { data: lifetimeAds = 0 } = useQuery({
    queryKey: ["lifetime-ads", user?.telegram_id],
    queryFn: async () => {
      if (!user?.telegram_id) return 0;
      const { count } = await supabase
        .from("ad_watches")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.telegram_id);
      return count || 0;
    },
    enabled: !!user?.telegram_id,
  });

  // Referrals' total ads watched
  const { data: referralAds = 0 } = useQuery({
    queryKey: ["referral-ads", user?.telegram_id],
    queryFn: async () => {
      if (!user?.telegram_id) return 0;
      const { data: refs } = await supabase
        .from("referrals")
        .select("invitee_id")
        .eq("inviter_id", user.telegram_id);
      if (!refs || refs.length === 0) return 0;
      const inviteeIds = refs.map((r: any) => r.invitee_id);
      const { count } = await supabase
        .from("ad_watches")
        .select("id", { count: "exact", head: true })
        .in("user_id", inviteeIds);
      return count || 0;
    },
    enabled: !!user?.telegram_id,
  });

  const { data: referralEarnings = 0 } = useQuery({
    queryKey: ["referral-earnings", user?.telegram_id],
    queryFn: async () => {
      if (!user?.telegram_id) return 0;
      const { data: refs } = await supabase
        .from("referrals")
        .select("invitee_id")
        .eq("inviter_id", user.telegram_id);
      if (!refs || refs.length === 0) return 0;
      const inviteeIds = refs.map((r: any) => r.invitee_id);
      const { count } = await supabase
        .from("user_tasks")
        .select("id", { count: "exact", head: true })
        .in("user_id", inviteeIds)
        .eq("status", "completed");
      return count || 0;
    },
    enabled: !!user?.telegram_id,
  });

  const { data: lifetimeCheckins = 0 } = useQuery({
    queryKey: ["lifetime-checkins", user?.telegram_id],
    queryFn: async () => {
      if (!user?.telegram_id) return 0;
      const { count } = await supabase
        .from("daily_checkins")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.telegram_id);
      return count || 0;
    },
    enabled: !!user?.telegram_id,
  });

  const completedCount = userTasks?.filter((ut) => ut.status === "completed").length || 0;
  const adsToday_     = adsToday?.length || 0;
  const streak        = checkinData?.streak || 0;
  const referralCount = referralData?.count || 0;
  const userLevel     = user?.level || 1;

  const rawAchievements = settings?.activity_achievements;
  const achievements: Achievement[] = Array.isArray(rawAchievements)
    ? (rawAchievements as Achievement[]).filter((a) => a.is_active)
    : [];

  const claimedIds = new Set((claimed as any[]).map((c) => c.achievement_id));

  const getCurrent = (ach: Achievement): number => {
    switch (ach.goal_type) {
      case "tasks_completed":   return completedCount;
      case "referrals":         return referralCount;
      case "referral_ads":      return referralAds;
      case "referral_earnings": return referralEarnings;
      case "checkin_streak":    return streak;
      case "daily_logins":      return lifetimeCheckins;
      case "ads_watched":       return lifetimeAds;
      case "level":             return userLevel;
      default:                  return 0;
    }
  };

  const getProgress = (ach: Achievement): number =>
    Math.min((getCurrent(ach) / Math.max(ach.goal_value, 1)) * 100, 100);

  const getRewardLabel = (ach: Achievement): string => {
    if (ach.reward_label) return ach.reward_label;
    if (ach.reward_amount && ach.reward_currency_id) {
      const cur = (currencies as any[]).find((c) => c.id === ach.reward_currency_id);
      return `${ach.reward_amount} ${cur?.symbol || ""}`.trim();
    }
    if (ach.xp_reward) return `${ach.xp_reward} XP`;
    return "—";
  };

  const handleClaim = async (ach: Achievement) => {
    if (!user?.telegram_id) return;
    try {
      const res = await claimMut.mutateAsync({ userId: user.telegram_id, achievementId: ach.id });
      const cur = (currencies as any[]).find((c) => c.id === ach.reward_currency_id);
      toast({
        title: t("success"),
        description: `+${res.reward || 0}${cur?.symbol ? " " + cur.symbol : ""}${res.xp ? ` • +${res.xp} XP` : ""}`,
      });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  // Completed referral_earning tasks — shown in Activity, not in Tasks page
  const { data: referralTaskItems = [] } = useQuery({
    queryKey: ["referral-earning-tasks", user?.telegram_id],
    queryFn: async () => {
      if (!user?.telegram_id) return [];
      const { data } = await supabase
        .from("user_tasks")
        .select("id, completed_at, tasks!inner(title_en, title_ar, reward_amount, reward_currency_id, currencies:reward_currency_id(symbol, icon_url))")
        .eq("user_id", user.telegram_id)
        .eq("tasks.type", "referral_earning")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!user?.telegram_id,
  });

  const tabs = [
    { id: "achievements" as const, icon: Trophy,     label: t("achievements") },
    { id: "feed" as const,         icon: LayoutList, label: t("activityFeed") },
    { id: "referrals" as const,    icon: TrendingUp, label: language === "ar" ? "أرباح الإحالة" : "Referral Earnings" },
  ];

  return (
    <div className="space-y-3 pb-4">
      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-yellow-400">{referralCount}</p>
          <p className="text-[9px] text-muted-foreground">{t("referrals")}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-primary">{lifetimeAds}</p>
          <p className="text-[9px] text-muted-foreground">{t("ads")}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-accent">{userLevel}</p>
          <p className="text-[9px] text-muted-foreground">{t("level")}</p>
        </div>
        <div className="glass-card rounded-xl p-2.5 text-center">
          <p className="text-base font-bold tabular-nums text-orange-400">{streak}</p>
          <p className="text-[9px] text-muted-foreground">{t("streak")}</p>
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
        {/* ── Achievements ── */}
        {tab === "achievements" && (
          <motion.div key="ach" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            {achievements.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Trophy className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{t("noData")}</p>
              </div>
            ) : (
              achievements.map((ach, i) => {
                const progress     = getProgress(ach);
                const current      = getCurrent(ach);
                const reachedGoal  = progress >= 100;
                const isClaimed    = claimedIds.has(ach.id);
                const Icon         = ACH_ICONS[ach.goal_type] || ACH_ICONS.default;
                const title        = language === "ar" && ach.title_ar ? ach.title_ar : ach.title_en;
                const desc         = language === "ar" && ach.desc_ar  ? ach.desc_ar  : ach.desc_en;
                const rewardLabel  = getRewardLabel(ach);
                const cur          = (currencies as any[]).find((c) => c.id === ach.reward_currency_id);

                return (
                  <motion.div
                    key={ach.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className={`glass-card rounded-xl p-3 ${
                      isClaimed ? "opacity-60" : reachedGoal ? "border border-accent/40" : ""
                    }`}
                    data-testid={`achievement-${ach.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isClaimed ? "bg-success/10" : reachedGoal ? "bg-accent/20" : "bg-primary/10"
                      }`}>
                        {isClaimed
                          ? <CheckCircle2 className="w-5 h-5 text-success" />
                          : reachedGoal
                            ? <Zap className="w-5 h-5 text-accent" />
                            : <Icon className="w-5 h-5 text-primary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {cur?.icon_url && (
                              <img src={cur.icon_url} alt={cur.symbol} className="w-3.5 h-3.5 rounded-full" />
                            )}
                            <Badge variant="outline" className={`text-[9px] ${
                              reachedGoal ? "border-accent/40 text-accent" : "border-border"
                            }`}>
                              {rewardLabel}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {current}/{ach.goal_value}
                          </span>
                        </div>

                        <div className="mt-2">
                          {isClaimed ? (
                            <Badge className="bg-success/10 text-success border-0 text-[10px]">
                              {t("claimed")}
                            </Badge>
                          ) : reachedGoal ? (
                            <Button
                              size="sm"
                              className="h-7 text-[11px] w-full"
                              onClick={() => handleClaim(ach)}
                              disabled={claimMut.isPending}
                              data-testid={`btn-claim-${ach.id}`}
                            >
                              {claimMut.isPending
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : t("claimReward")}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {/* ── Referral Earnings Tab ── */}
        {tab === "referrals" && (
          <motion.div key="ref-earn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            {referralTaskItems.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold mb-1">{language === "ar" ? "لا توجد أرباح بعد" : "No referral earnings yet"}</p>
                <p className="text-xs text-muted-foreground">{language === "ar" ? "أكمل مهام الإحالة لتظهر هنا" : "Complete referral tasks to see them here"}</p>
              </div>
            ) : (
              referralTaskItems.map((item: any, i: number) => {
                const task = item.tasks;
                const title = language === "ar" && task?.title_ar ? task.title_ar : task?.title_en;
                const time = item.completed_at
                  ? formatDistanceToNow(new Date(item.completed_at), { addSuffix: true, locale: language === "ar" ? ar : enUS })
                  : "";
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass-card rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-green-400/10">
                      {task?.currencies?.icon_url ? (
                        <img src={task.currencies.icon_url} alt="" className="w-5 h-5 rounded-full" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{time}</p>
                    </div>
                    {task?.reward_amount > 0 && (
                      <Badge variant="outline" className="text-[9px] shrink-0 border-green-500/30 text-green-400">
                        +{task.reward_amount} {task.currencies?.symbol || ""}
                      </Badge>
                    )}
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
      </AnimatePresence>
    </div>
  );
}
