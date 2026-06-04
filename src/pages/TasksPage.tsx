import { useState } from "react";
import { usePreferredCurrency } from '@/components/OnboardingModal';
  import { motion, AnimatePresence } from "framer-motion";
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
    ShoppingCart, Store, ListChecks, Clock, Package,
  } from "lucide-react";

  function flagEmoji(code: string) {
    if (!code || code.length !== 2) return "";
    return code.toUpperCase().split("").map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  }

  type MainTab = "seller" | "tasks" | "buyer";

  export function TasksPage() {
    const { t, language } = useLanguage();
    const { user } = useUser();
    const { toast } = useToast();
    const dir = language === "ar" ? "rtl" : "ltr";

    const [mainTab, setMainTab] = useState<MainTab>("seller");
    const [search, setSearch] = useState("");
    const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
    const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
    const [selectedTask, setSelectedTask] = useState<any | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const { data: tasks, isLoading: tasksLoading } = useTasks();
    const { data: allCurrencies } = useCurrencies();
    const preferredCurrencyId = usePreferredCurrency();
    const { data: userTasks } = useUserTasks(user?.telegram_id);
    const verifyMutation = useVerifyTask();

    const completedTaskIds = new Set(userTasks?.filter((ut) => ut.status === "completed").map((ut) => ut.task_id));
    const pendingTaskIds = new Set(userTasks?.filter((ut) => ut.status === "pending").map((ut) => ut.task_id));

    const allTasks = (tasks || []).filter((t) => t.type !== "referral_earning");

    const sellerTasks = allTasks.filter((t) =>
      t.metadata?.section === "seller" || (t.type === "submission" && !t.metadata?.section)
    );
    const generalTasks = allTasks.filter((t) =>
      t.metadata?.section === "tasks" || (!t.metadata?.section && t.type !== "submission")
    );
    const buyerTasks = allTasks.filter((t) => t.metadata?.section === "buyer");

    const currentTasks = mainTab === "seller" ? sellerTasks : mainTab === "buyer" ? buyerTasks : generalTasks;

    const filtered = currentTasks.filter((task) => {
      const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
      return title.toLowerCase().includes(search.toLowerCase());
    });

    const openSheet = (task: any) => { setSelectedTask(task); setSheetOpen(true); };
    const closeSheet = () => { setSheetOpen(false); setSelectedTask(null); };

    const handleStart = async (task: any) => {
      if (!user?.telegram_id) return;
      setPendingTaskId(task.id);
      try {
        await verifyMutation.mutateAsync({ userId: user.telegram_id, taskId: task.id, action: "start" });
        if (task.metadata?.redirect_url) {
          const url = task.metadata.redirect_url.replace("{{user_id}}", user.telegram_id);
          window.open(url, "_blank");
        } else if (task.metadata?.channel_url) {
          window.open(task.metadata.channel_url, "_blank");
        } else if (task.metadata?.app_link) {
          window.open(task.metadata.app_link, "_blank");
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setPendingTaskId(null);
      }
    };

    const handleVerify = async (task: any, code?: string) => {
      if (!user?.telegram_id) return;
      setPendingTaskId(task.id);
      try {
        await verifyMutation.mutateAsync({ userId: user.telegram_id, taskId: task.id, action: "verify", code });
        toast({ title: t("success"), description: t("taskCompleted") });
        closeSheet();
      } catch (err: any) {
        toast({ title: t("error"), description: err.message, variant: "destructive" });
      } finally {
        setPendingTaskId(null);
      }
    };

    const tabs: { id: MainTab; label: string; labelAr: string; icon: any; count: number }[] = [
      { id: "seller", label: "Seller", labelAr: "بائع", icon: Store, count: sellerTasks.length },
      { id: "tasks", label: "Tasks", labelAr: "مهام", icon: ListChecks, count: generalTasks.length },
      { id: "buyer", label: "Buyer", labelAr: "مشتري", icon: ShoppingCart, count: buyerTasks.length },
    ];

    const getCurrencyForTask = (task: any) => {
      if (!task.reward_currency_id) return null;
      return allCurrencies?.find((c: any) => c.id === task.reward_currency_id);
    };

    const getPreferredReward = (task: any) => {
      if (!preferredCurrencyId) return null;
      const extras = Array.isArray(task.extra_rewards) ? task.extra_rewards : [];
      const match = extras.find((r: any) => r.currency_id === preferredCurrencyId && Number(r.amount) > 0);
      if (!match) return null;
      const cur = allCurrencies?.find((c: any) => c.id === preferredCurrencyId);
      return cur ? { amount: match.amount, currency: cur } : null;
    };
    const getTaskCountries = (task: any): string[] => {
      const c = task.metadata?.countries;
      if (!c) return [];
      if (Array.isArray(c)) return c;
      if (typeof c === "string") return c.split(",").map((s: string) => s.trim()).filter(Boolean);
      return [];
    };

    const getSubmissionFields = (task: any): string[] => {
      const f = task.metadata?.submission_fields;
      if (!f) return [];
      if (Array.isArray(f)) return f;
      return [];
    };

    return (
      <div className="space-y-3" dir={dir}>
        {/* Main tab switcher */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setMainTab(tab.id); setSearch(""); }}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all"
                style={isActive ? {
                  background: "rgba(139,92,246,0.18)",
                  border: "1px solid rgba(139,92,246,0.35)",
                  color: "rgb(167,139,250)",
                } : { color: "rgba(255,255,255,0.4)", border: "1px solid transparent" }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mainTabBg"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.35)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{language === "ar" ? tab.labelAr : tab.label}</span>
                {tab.count > 0 && (
                  <span className="relative z-10 text-[9px] opacity-60">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={language === "ar" ? "بحث..." : "Search..."}
            className="ps-9 h-9 text-sm bg-secondary/50 border-border/50"
          />
        </div>

        {/* Tasks list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mainTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            {tasksLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {mainTab === "buyer" && language === "ar" ? "لا توجد منتجات متاحة" :
                 mainTab === "buyer" ? "No products available" :
                 mainTab === "seller" && language === "ar" ? "لا توجد مهام للبيع" :
                 mainTab === "seller" ? "No seller tasks available" :
                 language === "ar" ? "لا توجد مهام" : "No tasks found"}
              </div>
            ) : (
              filtered.map((task, i) => {
                const isCompleted = completedTaskIds.has(task.id);
                const isPending = pendingTaskIds.has(task.id);
                const currency = getCurrencyForTask(task);
                const countries = getTaskCountries(task);
                const submFields = getSubmissionFields(task);
                const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
                const maxAccounts = task.metadata?.max_accounts;

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => !isCompleted && openSheet(task)}
                    className="relative flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
                    style={{
                      background: isCompleted ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isCompleted ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                      style={{
                        background: isCompleted ? "rgba(34,197,94,0.12)" : mainTab === "buyer" ? "rgba(6,182,212,0.12)" : "rgba(139,92,246,0.12)",
                        border: `1px solid ${isCompleted ? "rgba(34,197,94,0.25)" : mainTab === "buyer" ? "rgba(6,182,212,0.25)" : "rgba(139,92,246,0.25)"}`,
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : task.icon_url ? (
                        <img src={task.icon_url} alt="" className="w-11 h-11 object-cover rounded-xl" />
                      ) : mainTab === "buyer" ? (
                        <Package className="w-5 h-5 text-cyan-400" />
                      ) : mainTab === "seller" ? (
                        <Upload className="w-5 h-5 text-purple-400" />
                      ) : (
                        <Star className="w-5 h-5 text-purple-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-white truncate">{title}</span>
                        {/* Country flags */}
                        {countries.length === 1 && (
                          <span className="text-base" title={countries[0]}>{flagEmoji(countries[0])}</span>
                        )}
                        {countries.length > 1 && (
                          <div className="flex gap-0.5">
                            {countries.slice(0, 3).map((c) => (
                              <span key={c} className="text-sm" title={c}>{flagEmoji(c)}</span>
                            ))}
                            {countries.length > 3 && <span className="text-[10px] text-white/40">+{countries.length - 3}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {/* Reward — show preferred currency if available */}
                        {task.reward_amount > 0 && (() => {
                          const pref = getPreferredReward(task);
                          const displayCur = pref?.currency || currency;
                          const displayAmt = pref?.amount || task.reward_amount;
                          return (
                            <div className="flex items-center gap-1">
                              {displayCur?.icon_url ? (
                                <img src={displayCur.icon_url} alt="" className="w-3.5 h-3.5 rounded-full" />
                              ) : (
                                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                              )}
                              <span className="text-xs text-yellow-400 font-bold">+{displayAmt} {displayCur?.symbol || ""}</span>
                            </div>
                          );
                        })()}
                        {/* Submission fields badges */}
                        {submFields.includes("email") && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(99,102,241,0.15)", color: "rgba(167,139,250,0.8)" }}>Email</span>
                        )}
                        {submFields.includes("password") && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(239,68,68,0.12)", color: "rgba(252,165,165,0.8)" }}>Password</span>
                        )}
                        {submFields.includes("screenshot") && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(6,182,212,0.12)", color: "rgba(103,232,249,0.8)" }}>Screenshot</span>
                        )}
                        {/* Max accounts */}
                        {maxAccounts && maxAccounts > 1 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "rgba(52,211,153,0.8)" }}>
                            {language === "ar" ? `حتى ${maxAccounts} حساب` : `Up to ${maxAccounts} accounts`}
                          </span>
                        )}
                        {/* Pending status */}
                        {isPending && (
                          <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/25 text-[9px] px-1.5 py-0 h-4">
                            {language === "ar" ? "قيد المراجعة" : "In review"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Right chevron or completed */}
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                    )}
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>

        {/* TaskSheet */}
        {selectedTask && (
          <TaskSheet
            task={selectedTask}
            open={sheetOpen}
            onClose={closeSheet}
            isCompleted={completedTaskIds.has(selectedTask?.id)}
            isPending={pendingTaskIds.has(selectedTask?.id)}
            isLoading={pendingTaskId === selectedTask?.id}
            onStart={() => handleStart(selectedTask)}
            onVerify={(code) => handleVerify(selectedTask, code)}
            codeInput={codeInputs[selectedTask?.id] || ""}
            onCodeChange={(v) => setCodeInputs((prev) => ({ ...prev, [selectedTask.id]: v }))}
          />
        )}
      </div>
    );
  }
  