import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useCheckinStatus, useDailyCheckin, useUserTasks, useTasks, useAppSettings } from "@/hooks/useSupabaseData";
import { AppIcon } from "@/components/AppIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DailyAdsCard } from "@/components/DailyAdsCard";
import { SpinWheel } from "@/components/SpinWheel";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import {
  CheckCircle2, Calendar, BookOpen, ChevronRight, Flame, Star, Loader2,
} from "lucide-react";

export function HomePage() {
  const { t, language } = useLanguage();
  const { user, balances } = useUser();
  const { toast } = useToast();
  const userId = user?.telegram_id;

  const { data: checkinData, isLoading: checkinLoading } = useCheckinStatus(userId);
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: userTasks } = useUserTasks(userId);
  const { data: settings } = useAppSettings();
  const sectionIcons = (settings?.app_icons || {}) as Record<string, string>;
  const checkinMutation = useDailyCheckin();

  const expToNext = 5000;
  const expProgress = user ? ((user.exp % expToNext) / expToNext) * 100 : 0;

  const completedCount = userTasks?.filter((ut) => ut.status === "completed").length || 0;
  const usdtBalance = balances.find((b) => b.currencies?.symbol === "USDT")?.amount || 0;
  const tonBalance = balances.find((b) => b.currencies?.symbol === "TON")?.amount || 0;

  const tonCurrency = balances.find((b) => b.currencies?.symbol === "TON")?.currencies;
  const usdtCurrency = balances.find((b) => b.currencies?.symbol === "USDT")?.currencies;

  const TON_ICON = "https://ton.org/icons/ton_symbol.svg";
  const USDT_ICON = "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040";

  const stats = [
    { iconEl: <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-primary" />, label: t("completedTasks"), value: String(completedCount) },
    {
      iconEl: <img src={tonCurrency?.icon_url || TON_ICON} alt="TON" className="w-5 h-5 mx-auto mb-1 rounded-full object-contain" />,
      label: t("totalCoins"),
      value: `${Number(tonBalance).toFixed(2)} TON`,
    },
    {
      iconEl: <img src={usdtCurrency?.icon_url || USDT_ICON} alt="USDT" className="w-5 h-5 mx-auto mb-1 rounded-full object-contain" />,
      label: t("usdtBalance"),
      value: `$${Number(usdtBalance).toFixed(2)}`,
    },
  ];

  const handleCheckin = async () => {
    if (!userId) return;
    hapticImpact("medium");
    try {
      const result = await checkinMutation.mutateAsync(userId);
      hapticNotification("success");
      toast({ title: t("success"), description: `+${result.reward} TON  •  +${result.xpReward} ${t("exp")} (${result.streak} ${t("streak")})` });
    } catch (err: any) {
      hapticNotification("error");
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const requiredTasks = tasks?.filter((task) => task.is_required).slice(0, 3) || [];
  const completedTaskIds = new Set(userTasks?.filter((ut) => ut.status === "completed").map((ut) => ut.task_id));

  return (
    <div className="space-y-4 pb-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border-2 border-primary/30">
            <AvatarImage src={user?.photo_url} />
            <AvatarFallback className="bg-secondary text-lg font-bold">{user?.first_name?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold truncate">{user?.first_name} {user?.last_name}</h2>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px] px-1.5 py-0">
                <Star className="w-2.5 h-2.5 mr-0.5" />{t("level")} {user?.level || 1}
              </Badge>
            </div>
            {user?.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Progress value={expProgress} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{user?.exp || 0}/{expToNext} {t("exp")}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (i + 1) }} className="glass-card rounded-xl p-3 text-center">
            {stat.iconEl}
            <p className="text-sm font-bold tabular-nums truncate">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Daily Check-in */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center overflow-hidden shrink-0">
              <AppIcon src={sectionIcons.section_checkin} fallback={Calendar} size={32} className="w-9 h-9 text-accent object-contain" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{t("dailyCheckin")}</h3>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Flame className="w-3 h-3 text-accent" />
                {checkinLoading ? "..." : checkinData?.streak || 0} {t("streak")}
                {checkinData?.nextReward ? (
                  <span className="ms-1 text-accent font-semibold">
                    • +{checkinData.nextReward} {checkinData.currencySymbol}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <Button size="sm" disabled={checkinData?.claimedToday || checkinMutation.isPending} onClick={handleCheckin}
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-8 text-xs font-semibold px-4 disabled:opacity-50">
            {checkinMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : checkinData?.claimedToday ? t("claimed") : t("claimReward")}
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => {
            const streakDay = checkinData?.streak || 0;
            const currentDay = ((streakDay - 1) % 7) + 1;
            return (
              <div key={i} className={`h-1.5 rounded-full ${
                i < currentDay ? "bg-accent" : i === currentDay ? "bg-accent/40 animate-pulse-glow" : "bg-secondary"
              }`} />
            );
          })}
        </div>
      </motion.div>

      {/* Daily Ads — same shape as check-in */}
      <DailyAdsCard />

      {/* Spin & Win wheel */}
      <SpinWheel />

      {/* Official Guide */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="glass-card rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:border-primary/30 transition-colors">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
          <AppIcon src={sectionIcons.section_guide} fallback={BookOpen} size={32} className="w-9 h-9 text-primary object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{t("officialGuide")}</h3>
          <p className="text-[10px] text-muted-foreground">{t("guideDesc")}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 rtl:rotate-180" />
      </motion.div>

      {/* Required Tasks */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h3 className="font-semibold text-sm mb-2 px-1 flex items-center gap-1.5">
          {sectionIcons.section_tasks && (
            <AppIcon src={sectionIcons.section_tasks} fallback={Star} size={16} className="w-4 h-4 object-contain" />
          )}
          {t("requiredTasks")}
        </h3>
        {tasksLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-2">
            {requiredTasks.map((task) => {
              const done = completedTaskIds.has(task.id);
              const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
              const taskCur = (task as any).currencies;
              const taskSym = taskCur?.symbol || "TON";
              const taskIcon = taskCur?.icon_url || (taskSym === "TON" ? TON_ICON : taskSym === "USDT" ? USDT_ICON : null);
              return (
                <div key={task.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${done ? "bg-success/10" : "bg-accent/10"}`}>
                    {done ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Star className="w-4 h-4 text-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{title}</p>
                    <p className="text-[10px] text-accent flex items-center gap-0.5">
                      {taskIcon ? (
                        <img src={taskIcon} alt={taskSym} className="w-3 h-3 rounded-full inline" />
                      ) : null}
                      +{task.reward_amount} {taskSym}
                    </p>
                  </div>
                </div>
              );
            })}
            {requiredTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t("noData")}</p>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
