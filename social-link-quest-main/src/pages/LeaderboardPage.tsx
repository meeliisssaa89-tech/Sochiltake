import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useLeaderboard, usePlatformStats, useReferrals, useUserTasks, useRedeemPromoCode } from "@/hooks/useSupabaseData";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Send, ListChecks, Gift, Users, Clock, Trophy, Medal, Crown, Tag, Loader2,
} from "lucide-react";

export function LeaderboardPage() {
  const { t } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();
  const [rankType, setRankType] = useState<"tasks" | "referrals">("tasks");
  const [promoCode, setPromoCode] = useState("");
  const redeemPromo = useRedeemPromoCode();

  const { data: leaderboard, isLoading } = useLeaderboard(rankType);
  const { data: stats } = usePlatformStats();
  const { data: referralData } = useReferrals(user?.telegram_id);
  const { data: userTasks } = useUserTasks(user?.telegram_id);

  const myRank = leaderboard?.findIndex((e) => e.userId === user?.telegram_id) ?? -1;
  const myScore = myRank >= 0 ? leaderboard![myRank].score : 0;

  const botUsername = "CyberPulseBot";
  const referralLink = `https://t.me/${botUsername}?start=ref_${user?.telegram_id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: t("copied") });
  };

  const shareOnTelegram = () => {
    const text = encodeURIComponent("Join CyberPulse and earn rewards! 🚀");
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, "_blank");
  };

  const handleRedeem = async () => {
    if (!user?.telegram_id || !promoCode.trim()) return;
    try {
      const result = await redeemPromo.mutateAsync({ userId: user.telegram_id, code: promoCode.trim().toUpperCase() });
      toast({
        title: t("success"),
        description: result.message || `+${result.reward} • +${result.xp} XP`,
      });
      setPromoCode("");
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const platformStats = [
    { icon: ListChecks, label: t("totalTasks"), value: stats?.totalTasks?.toLocaleString() || "0" },
    { icon: Gift, label: t("totalRewards"), value: stats?.totalCompleted?.toLocaleString() || "0" },
    { icon: Users, label: t("totalUsers"), value: stats?.totalUsers?.toLocaleString() || "0" },
    { icon: Clock, label: t("uptime"), value: "99.9%" },
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-accent" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-accent/70" />;
    return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Promo Code Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-4 border-accent/20">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Tag className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("promoCode")}</h3>
            <p className="text-[10px] text-muted-foreground">{t("promoDesc")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder={t("enterPromoCode")}
            className="h-9 text-xs font-mono flex-1 rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          />
          <Button
            size="sm"
            disabled={redeemPromo.isPending || !promoCode.trim()}
            onClick={handleRedeem}
            className="rounded-xl h-9 text-xs bg-accent hover:bg-accent/90 text-accent-foreground px-4"
          >
            {redeemPromo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t("redeem")}
          </Button>
        </div>
      </motion.div>

      {/* Invite Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-2xl p-4 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t("inviteFriends")}</h3>
            <p className="text-[10px] text-muted-foreground">
              {t("inviteDesc")} • {referralData?.count || 0} {t("referralRanking")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyLink} className="flex-1 rounded-xl h-8 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Copy className="w-3 h-3 me-1" /> {t("copyLink")}
          </Button>
          <Button size="sm" onClick={shareOnTelegram} className="flex-1 rounded-xl h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
            <Send className="w-3 h-3 me-1" /> {t("shareOnTelegram")}
          </Button>
        </div>
      </motion.div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 gap-2">
        {platformStats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i }} className="glass-card rounded-xl p-3 flex items-center gap-2">
            <stat.icon className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold tabular-nums">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Ranking Toggle */}
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        <button onClick={() => setRankType("tasks")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${rankType === "tasks" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          {t("tasksRanking")}
        </button>
        <button onClick={() => setRankType("referrals")} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${rankType === "referrals" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          {t("referralRanking")}
        </button>
      </div>

      {/* Your Rank */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-3 flex items-center gap-3 border-accent/20">
        <Trophy className="w-5 h-5 text-accent shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{t("yourRank")}</p>
          <p className="font-bold">#{myRank >= 0 ? myRank + 1 : "—"}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-muted-foreground">{rankType === "tasks" ? t("tasksCompleted") : t("referralRanking")}</p>
          <p className="font-bold text-accent tabular-nums">{myScore}</p>
        </div>
      </motion.div>

      {/* Leaderboard List */}
      {isLoading ? (
        <div className="space-y-1.5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-1.5">
          {(leaderboard || []).slice(0, 20).map((entry, i) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className={`glass-card rounded-xl p-3 flex items-center gap-3 ${i < 3 ? "border-primary/10" : ""}`}
            >
              <div className="w-8 flex items-center justify-center shrink-0">{getRankIcon(i + 1)}</div>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-secondary text-xs font-bold">{entry.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.name}</p>
              </div>
              <p className="text-xs font-semibold text-accent tabular-nums">{entry.score}</p>
            </motion.div>
          ))}
          {(!leaderboard || leaderboard.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-4">{t("noData")}</p>
          )}
        </div>
      )}
    </div>
  );
}
