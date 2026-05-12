import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useTasks, useUserTasks, useVerifyTask, useCurrencies } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TaskSheet } from "@/components/TaskSheet";
import {
  Search, Send, Globe, Eye, Star, CheckCircle2, Coins, ChevronRight, Upload,
} from "lucide-react";

type FilterType = "all" | "telegram_join" | "social_link" | "watch_ad" | "code_api" | "submission";

export function TasksPage() {
  const { t, language } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: allCurrencies } = useCurrencies();
  const { data: userTasks } = useUserTasks(user?.telegram_id);
  const verifyMutation = useVerifyTask();

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: t("allTasks") },
    { id: "telegram_join", label: t("telegramTasks") },
    { id: "social_link", label: t("twitterTasks") },
    { id: "watch_ad", label: t("watchAd") },
    { id: "code_api", label: "Code" },
    { id: "submission", label: "Submit" },
  ];

  const completedTaskIds = new Set(userTasks?.filter((ut) => ut.status === "completed").map((ut) => ut.task_id));
  const pendingTaskIds   = new Set(userTasks?.filter((ut) => ut.status === "pending").map((ut) => ut.task_id));

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
      case "social_link":   return Globe;
      case "watch_ad":      return Eye;
      case "code_api":      return Globe;
      case "submission":    return Upload;
      default:              return Star;
    }
  };

  const openSheet = (task: any) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setTimeout(() => setSelectedTask(null), 300);
  };

  const handleTaskAction = async (taskId: string, action: string, code?: string) => {
    if (!user?.telegram_id) return;
    setPendingTaskId(taskId);
    try {
      const result = await verifyMutation.mutateAsync({ userId: user.telegram_id, taskId, action, code });

      if (result.status === "started" || result.status === "submitted" || result.status === "pending") {
        if (result.channelUrl) window.open(result.channelUrl, "_blank");
        else if (result.url) window.open(result.url, "_blank");
        if (result.status === "submitted") {
          toast({ title: t("success"), description: "Submitted for review!" });
          closeSheet();
        } else if (result.status !== "pending") {
          toast({ title: t("success"), description: "Task started! Complete the action, then verify." });
        }
      } else if (result.verified) {
        toast({
          title: t("success"),
          description: result.xp > 0 ? `+${result.reward}  •  +${result.xp} EXP` : `+${result.reward}`,
        });
        setCodeInputs((p) => { const n = { ...p }; delete n[taskId]; return n; });
        closeSheet();
      }
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setPendingTaskId(null);
    }
  };

  const selectedIsCompleted = selectedTask ? completedTaskIds.has(selectedTask.id) : false;
  const selectedIsPending   = selectedTask ? pendingTaskIds.has(selectedTask.id) : false;
  const selectedIsLoading   = selectedTask ? pendingTaskId === selectedTask.id : false;

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
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task, i) => {
            const Icon = getTaskIcon(task.type);
            const isCompleted = completedTaskIds.has(task.id);
            const isPending   = pendingTaskIds.has(task.id);
            const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card rounded-xl p-3 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => openSheet(task)}
              >
                {/* Icon */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                    isCompleted ? "bg-success/10" : (task as any).icon_url ? "bg-transparent" : "bg-primary/10"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (task as any).icon_url ? (
                    <img
                      src={(task as any).icon_url}
                      alt=""
                      className="w-10 h-10 object-cover rounded-xl"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Icon className="w-5 h-5 text-primary" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{title}</p>
                    {task.is_required && (
                      <Badge className="bg-destructive/10 text-destructive border-0 text-[9px] px-1 py-0 h-4 shrink-0">
                        {t("required")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {task.reward_amount > 0 && (
                      <span className="text-[10px] text-accent flex items-center gap-0.5">
                        {(task as any).currencies?.icon_url ? (
                          <img src={(task as any).currencies.icon_url} alt="" className="w-3 h-3 rounded-full" />
                        ) : (
                          <Coins className="w-3 h-3" />
                        )}
                        +{task.reward_amount} {(task as any).currencies?.symbol || ""}
                      </span>
                    )}
                    {Array.isArray((task as any).extra_rewards) &&
                      (task as any).extra_rewards.map((r: any, idx: number) => {
                        const cur = (allCurrencies || []).find((c: any) => c.id === r.currency_id);
                        if (!cur || !r.amount) return null;
                        return (
                          <span key={idx} className="text-[10px] text-accent flex items-center gap-0.5">
                            {cur.icon_url ? <img src={cur.icon_url} alt="" className="w-3 h-3 rounded-full" /> : <Coins className="w-3 h-3" />}
                            +{r.amount} {cur.symbol}
                          </span>
                        );
                      })}
                    {task.xp_reward > 0 && (
                      <span className="text-[10px] text-primary">+{task.xp_reward} EXP</span>
                    )}
                  </div>
                </div>

                {/* Status / Chevron */}
                <div className="shrink-0">
                  {isCompleted ? (
                    <Badge variant="outline" className="border-success/30 text-success text-[10px]">
                      {t("completed")}
                    </Badge>
                  ) : isPending && task.type === "submission" ? (
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 text-[10px]">
                      Review
                    </Badge>
                  ) : isPending ? (
                    <Badge variant="outline" className="border-accent/30 text-accent text-[10px]">
                      Pending
                    </Badge>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {t("noTasks") || "No tasks found"}
            </div>
          )}
        </div>
      )}

      {/* Available count */}
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">
          {availableCount} {t("availableTasks")}
        </p>
      </div>

      {/* Task Sheet */}
      <TaskSheet
        task={selectedTask}
        open={sheetOpen}
        onClose={closeSheet}
        isCompleted={selectedIsCompleted}
        isPending={selectedIsPending}
        isLoading={selectedIsLoading}
        onStart={() => selectedTask && handleTaskAction(selectedTask.id, "start")}
        onVerify={(code) => selectedTask && handleTaskAction(selectedTask.id, "verify", code || codeInputs[selectedTask.id])}
        codeInput={selectedTask ? (codeInputs[selectedTask.id] || "") : ""}
        onCodeChange={(v) => selectedTask && setCodeInputs((p) => ({ ...p, [selectedTask.id]: v }))}
      />
    </div>
  );
}
