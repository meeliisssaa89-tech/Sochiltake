import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useUserTasks, useReferrals, useCheckinStatus } from "@/hooks/useSupabaseData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Coins,
  DollarSign,
  CheckCircle2,
  Users,
  TrendingUp,
  Award,
  Target,
  Zap,
} from "lucide-react";

export function ActivityPage() {
  const { t } = useLanguage();
  const { user, balances } = useUser();
  const [mainTab, setMainTab] = useState<"achievements" | "daily" | "events">("achievements");
  const [subTab, setSubTab] = useState<"invite" | "team" | "earnings">("invite");

  const { data: userTasks, isLoading } = useUserTasks(user?.telegram_id);
  const { data: referralData } = useReferrals(user?.telegram_id);
  const { data: checkinData } = useCheckinStatus(user?.telegram_id);

  const completedCount = userTasks?.filter((ut) => ut.status === "completed").length || 0;
  const fgBalance = balances.find((b) => b.currencies?.symbol === "FG")?.amount || 0;
  const usdtBalance = balances.find((b) => b.currencies?.symbol === "USDT")?.amount || 0;

  const overviewCards = [
    { icon: Coins, label: t("fgEarned"), value: fgBalance.toLocaleString(), max: "50,000", progress: Math.min((fgBalance / 50000) * 100, 100), color: "text-accent" },
    { icon: DollarSign, label: t("usdtEarned"), value: `$${usdtBalance.toFixed(2)}`, max: "$100", progress: Math.min((usdtBalance / 100) * 100, 100), color: "text-success" },
    { icon: CheckCircle2, label: t("tasksCompleted"), value: String(completedCount), max: "100", progress: Math.min((completedCount / 100) * 100, 100), color: "text-primary" },
  ];

  const achievements = [
    {
      title: "Early Bird",
      desc: "Complete 10 tasks",
      progress: Math.min((completedCount / 10) * 100, 100),
      reward: "500 FG",
      icon: Zap,
    },
    {
      title: "Social Butterfly",
      desc: "Link 5 social accounts",
      progress: 0,
      reward: "1,000 FG",
      icon: Users,
    },
    {
      title: "Streak Master",
      desc: "30-day check-in streak",
      progress: Math.min(((checkinData?.streak || 0) / 30) * 100, 100),
      reward: "2,000 FG",
      icon: Target,
    },
    {
      title: "Top Referrer",
      desc: "Invite 20 friends",
      progress: Math.min(((referralData?.count || 0) / 20) * 100, 100),
      reward: "5,000 FG",
      icon: Award,
    },
    {
      title: "Task Champion",
      desc: "Complete 50 tasks",
      progress: Math.min((completedCount / 50) * 100, 100),
      reward: "10,000 FG",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-4 pb-4">
      {/* Main Tabs */}
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        {(["achievements", "daily", "events"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              mainTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {overviewCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{card.value}</span>
              </div>
              <Progress value={card.progress} className="h-1.5" />
              <p className="text-[9px] text-muted-foreground mt-1 text-end tabular-nums">
                {card.value} / {card.max}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex gap-2">
        {(["invite", "team", "earnings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === tab
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {t(tab === "earnings" ? "earningsTab" : tab)}
          </button>
        ))}
      </div>

      {/* Achievement Cards */}
      <div className="space-y-2">
        {achievements.map((ach, i) => (
          <motion.div
            key={ach.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="glass-card rounded-xl p-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ach.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{ach.title}</p>
                  <Badge variant="outline" className="text-[9px] border-accent/30 text-accent">
                    {ach.reward}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{ach.desc}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={ach.progress} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(ach.progress)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
