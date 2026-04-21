import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useTasks, useUserTasks, useVerifyTask } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Send,
  Twitter,
  Instagram,
  Eye,
  Star,
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  Globe,
} from "lucide-react";

type FilterType = "all" | "telegram_join" | "social_link" | "watch_ad";

export function TasksPage() {
  const { t, language } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: userTasks } = useUserTasks(user?.telegram_id);
  const verifyMutation = useVerifyTask();

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: t("allTasks") },
    { id: "telegram_join", label: t("telegramTasks") },
    { id: "social_link", label: t("twitterTasks") },
    { id: "watch_ad", label: t("watchAd") },
  ];

  const completedTaskIds = new Set(userTasks?.filter((ut) => ut.status === "completed").map((ut) => ut.task_id));
  const pendingTaskIds = new Set(userTasks?.filter((ut) => ut.status === "pending").map((ut) => ut.task_id));

  const filtered = (tasks || []).filter((task) => {
    const matchesFilter = activeFilter === "all" || task.type === activeFilter;
    const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
    const matchesSearch = title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const availableCount = filtered.filter((t) => !completedTaskIds.has(t.id)).length;

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "telegram_join": return Send;
      case "social_link": return Globe;
      case "watch_ad": return Eye;
      default: return Star;
    }
  };

  const handleTaskAction = async (taskId: string, action: string) => {
    if (!user?.telegram_id) return;
    setPendingTaskId(taskId);
    try {
      const result = await verifyMutation.mutateAsync({
        userId: user.telegram_id,
        taskId,
        action,
      });

      if (result.status === "started") {
        // Open URL if available
        if (result.channelUrl) {
          window.open(result.channelUrl, "_blank");
        } else if (result.url) {
          window.open(result.url, "_blank");
        }
        toast({ title: t("success"), description: action === "start" ? "Task started! Complete the action, then verify." : undefined });
      } else if (result.verified) {
        toast({
          title: t("success"),
          description: `+${result.reward}`,
        });
      }
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
        <Input
          placeholder={t("searchTasks")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rtl:pl-3 rtl:pr-9 bg-card border-border rounded-xl h-10"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeFilter === filter.id
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {tasksLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task, i) => {
            const Icon = getTaskIcon(task.type);
            const isCompleted = completedTaskIds.has(task.id);
            const isPending = pendingTaskIds.has(task.id);
            const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
            const isThisLoading = pendingTaskId === task.id;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-xl p-3 flex items-center gap-3"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCompleted ? "bg-success/10" : "bg-primary/10"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <Icon className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{title}</p>
                    {task.is_required && (
                      <Badge className="bg-destructive/10 text-destructive border-0 text-[9px] px-1 py-0 h-4">
                        {t("required")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-accent flex items-center gap-0.5">
                      {(task as any).currencies?.icon_url ? (
                        <img src={(task as any).currencies.icon_url} alt={(task as any).currencies.symbol} className="w-3 h-3 rounded-full" />
                      ) : (
                        <Coins className="w-3 h-3" />
                      )}
                      +{task.reward_amount} {(task as any).currencies?.symbol || "FG"}
                    </span>
                  </div>
                </div>
                {isCompleted ? (
                  <Badge variant="outline" className="border-success/30 text-success text-[10px]">
                    {t("completed")}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={isThisLoading}
                    onClick={() => handleTaskAction(task.id, isPending ? "verify" : "start")}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl h-8 text-xs font-semibold px-3"
                  >
                    {isThisLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isPending ? (
                      t("verifyTask")
                    ) : (
                      <>
                        {t("startTask")}
                        <ExternalLink className="w-3 h-3 ms-1" />
                      </>
                    )}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Available count */}
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">
          {availableCount} {t("availableTasks")}
        </p>
      </div>
    </div>
  );
}
