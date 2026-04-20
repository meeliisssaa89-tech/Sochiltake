import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useUserTasks, useReferrals, useCheckinStatus, useAppSettings, useAdsToday } from "@/hooks/useSupabaseData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins, DollarSign, CheckCircle2, Users, TrendingUp, Award, Target, Zap, Eye,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  tasks_completed: CheckCircle2,
  referrals: Users,
  checkin_streak: Target,
  ads_watched: Eye,
  default: Award,
};

interface Achievement {
  id: string;
  title_en: string;
  title_ar: string;
  desc_en: string;
  desc_ar: string;
  goal_type: string;
  goal_value: number;
  reward_label: string;
  is_active: boolean;
}

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: "1", title_en: "Early Bird", title_ar: "الطائر المبكر", desc_en: "Complete 10 tasks", desc_ar: "أكمل 10 مهام", goal_type: "tasks_completed", goal_value: 10, reward_label: "500 TON", is_active: true },
  { id: "2", title_en: "Streak Master", title_ar: "ملك السلاسل", desc_en: "30-day check-in streak", desc_ar: "سلسلة 30 يوم", goal_type: "checkin_streak", goal_value: 30, reward_label: "2,000 TON", is_active: true },
  { id: "3", title_en: "Top Referrer", title_ar: "أفضل مُحيل", desc_en: "Invite 20 friends", desc_ar: "ادعُ 20 صديقاً", goal_type: "referrals", goal_value: 20, reward_label: "5,000 TON", is_active: true },
  { id: "4", title_en: "Task Champion", title_ar: "بطل المهام", desc_en: "Complete 50 tasks", desc_ar: "أكمل 50 مهمة", goal_type: "tasks_completed", goal_value: 50, reward_label: "10,000 TON", is_active: true },
  { id: "5", title_en: "Ad Watcher", title_ar: "مشاهد الإعلانات", desc_en: "Watch 100 ads", desc_ar: "شاهد 100 إعلان", goal_type: "ads_watched", goal_value: 100, reward_label: "1,000 TON", is_active: true },
];

export function ActivityPage() {
  const { t, language } = useLanguage();
  const { user, balances } = useUser();
  const [mainTab, setMainTab] = useState<"achievements" | "daily" | "events">("achievements");

  const { data: userTasks, isLoading } = useUserTasks(user?.telegram_id);
  const { data: referralData } = useReferrals(user?.telegram_id);
  const { data: checkinData } = useCheckinStatus(user?.telegram_id);
  const { data: settings } = useAppSettings();
  const { data: adsToday } = useAdsToday(user?.telegram_id);

  const completedCount = userTasks?.filter((ut) => ut.status === "completed").length || 0;
  const tonBalance = balances.find((b) => b.currencies?.symbol === "TON")?.amount || 0;
  const usdtBalance = balances.find((b) => b.currencies?.symbol === "USDT")?.amount || 0;
  const adsWatched = adsToday?.length || 0;
  const streak = checkinData?.streak || 0;
  const referralCount = referralData?.count || 0;

  const rawAchievements = settings?.activity_achievements;
  const achievements: Achievement[] = Array.isArray(rawAchievements) && rawAchievements.length > 0
    ? (rawAchievements as Achievement[]).filter((a) => a.is_active)
    : DEFAULT_ACHIEVEMENTS;

  const getProgress = (ach: Achievement): number => {
    let current = 0;
    switch (ach.goal_type) {
      case "tasks_completed": current = completedCount; break;
      case "referrals": current = referralCount; break;
      case "checkin_streak": current = streak; break;
      case "ads_watched": current = adsWatched; break;
    }
    return Math.min((current / Math.max(ach.goal_value, 1)) * 100, 100);
  };

  const overviewCards = [
    { icon: Coins, label: t("tonEarned"), value: tonBalance.toLocaleString() + " TON", max: "50,000", progress: Math.min((tonBalance / 50000) * 100, 100), color: "text-accent" },
    { icon: DollarSign, label: t("usdtEarned"), value: `$${usdtBalance.toFixed(2)}`, max: "$100", progress: Math.min((usdtBalance / 100) * 100, 100), color: "text-success" },
    { icon: CheckCircle2, label: t("tasksCompleted"), value: String(completedCount), max: "100", progress: Math.min((completedCount / 100) * 100, 100), color: "text-primary" },
  ];

  return (
    <div className="space-y-4 pb-4">
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        {(["achievements", "daily", "events"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${mainTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {overviewCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{card.value}</span>
              </div>
              <Progress value={card.progress} className="h-1.5" />
              <p className="text-[9px] text-muted-foreground mt-1 text-end tabular-nums">{card.value} / {card.max}</p>
            </motion.div>
          ))}
        </div>
      )}

      {mainTab === "achievements" && (
        <div className="space-y-2">
          {achievements.map((ach, i) => {
            const progress = getProgress(ach);
            const Icon = ICON_MAP[ach.goal_type] || ICON_MAP.default;
            const title = language === "ar" && ach.title_ar ? ach.title_ar : ach.title_en;
            const desc = language === "ar" && ach.desc_ar ? ach.desc_ar : ach.desc_en;
            const done = progress >= 100;
            return (
              <motion.div key={ach.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className={`glass-card rounded-xl p-3 ${done ? "border-accent/30" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${done ? "bg-accent/20" : "bg-primary/10"}`}>
                    {done ? <Zap className="w-5 h-5 text-accent" /> : <Icon className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{title}</p>
                      <Badge variant="outline" className={`text-[9px] ${done ? "border-accent/30 text-accent" : "border-border"}`}>
                        {ach.reward_label}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {achievements.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t("noData")}</p>}
        </div>
      )}

      {mainTab === "daily" && (
        <div className="space-y-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 text-center space-y-2">
            <Target className="w-8 h-8 text-accent mx-auto" />
            <p className="font-semibold">{t("dailyCheckin")}</p>
            <p className="text-2xl font-bold text-accent">{streak}</p>
            <p className="text-xs text-muted-foreground">{t("streak")}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4 text-center space-y-2">
            <Eye className="w-8 h-8 text-primary mx-auto" />
            <p className="font-semibold">{t("dailyAds")}</p>
            <p className="text-2xl font-bold text-primary">{adsWatched}</p>
            <p className="text-xs text-muted-foreground">{t("adsToday")}</p>
          </motion.div>
        </div>
      )}

      {mainTab === "events" && (
        <div className="glass-card rounded-xl p-6 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        </div>
      )}
    </div>
  );
}
