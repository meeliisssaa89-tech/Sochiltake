import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllUsers, useAllTasks, useCurrencies, usePlatformStats, useUploadImage, useUpdateCurrency } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AdminAdsView } from "@/components/admin/AdminAdsView";
import { AdminIconsView } from "@/components/admin/AdminIconsView";
import { AdminBroadcastView } from "@/components/admin/AdminBroadcastView";
import { AdminSettingsView } from "@/components/admin/AdminSettingsView";
import { AdminTasksView } from "@/components/admin/AdminTasksView";
import { AdminSpinView } from "@/components/admin/AdminSpinView";
import { AdminWalletView } from "@/components/admin/AdminWalletView";
import { AdminWithdrawalsView } from "@/components/admin/AdminWithdrawalsView";
import {
  LayoutDashboard, Users, ListChecks, Coins, Settings, Search, Ban, ArrowLeft,
  TrendingUp, DollarSign, CheckCircle2, UserPlus, Image as ImageIcon, Send,
  Sparkles, Wallet, Upload, Loader2,
} from "lucide-react";

type AdminTab = "dashboard" | "users" | "tasks" | "currencies" | "ads" | "spin" | "wallet" | "icons" | "broadcast" | "settings" | "withdrawals";

export function AdminPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  const tabs = [
    { id: "dashboard" as const, icon: LayoutDashboard, label: t("dashboard") },
    { id: "users" as const, icon: Users, label: t("userManagement") },
    { id: "tasks" as const, icon: ListChecks, label: t("taskManagement") },
    { id: "currencies" as const, icon: Coins, label: t("currencyManagement") },
    { id: "withdrawals" as const, icon: Wallet, label: t("withdrawManagement") },
    { id: "ads" as const, icon: TrendingUp, label: t("adsConfig") },
    { id: "spin" as const, icon: Sparkles, label: t("spinManagement") },
    { id: "wallet" as const, icon: Wallet, label: t("walletManagement") },
    { id: "icons" as const, icon: ImageIcon, label: t("appearance") },
    { id: "broadcast" as const, icon: Send, label: t("broadcast") },
    { id: "settings" as const, icon: Settings, label: t("settings") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <a href="/" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            </a>
            <h1 className="text-lg font-bold gradient-text-cyan">{t("admin")}</h1>
          </div>
        </div>
        <div className="flex overflow-x-auto px-4 pb-2 gap-1 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {activeTab === "dashboard" && <DashboardView />}
        {activeTab === "users" && <UsersView search={searchQuery} setSearch={setSearchQuery} />}
        {activeTab === "tasks" && <AdminTasksView />}
        {activeTab === "currencies" && <CurrenciesView />}
        {activeTab === "withdrawals" && <AdminWithdrawalsView />}
        {activeTab === "ads" && <AdminAdsView />}
        {activeTab === "spin" && <AdminSpinView />}
        {activeTab === "wallet" && <AdminWalletView />}
        {activeTab === "icons" && <AdminIconsView />}
        {activeTab === "broadcast" && <AdminBroadcastView />}
        {activeTab === "settings" && <AdminSettingsView />}
      </div>
    </div>
  );
}

function DashboardView() {
  const { t } = useLanguage();
  const { data: stats } = usePlatformStats();
  const { data: allUsers } = useAllUsers();

  const today = new Date().toISOString().split("T")[0];
  const activeToday = allUsers?.filter((u) => u.updated_at?.startsWith(today)).length || 0;

  const dashStats = [
    { icon: Users, label: t("totalUsers"), value: stats?.totalUsers?.toLocaleString() || "0", color: "text-primary" },
    { icon: UserPlus, label: t("activeUsers"), value: String(activeToday), color: "text-success" },
    { icon: CheckCircle2, label: t("tasksCompleted"), value: stats?.totalCompleted?.toLocaleString() || "0", color: "text-accent" },
    { icon: DollarSign, label: t("rewardsDistributed"), value: `${stats?.totalCompleted || 0}`, color: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {dashStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card rounded-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{stat.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function UsersView({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useAllUsers();

  const filtered = (users || []).filter((u) => {
    const s = search.toLowerCase();
    return (
      (u.username || "").toLowerCase().includes(s) ||
      (u.first_name || "").toLowerCase().includes(s) ||
      u.telegram_id.includes(s)
    );
  });

  const toggleBan = async (telegramId: string, isBanned: boolean) => {
    await supabase.from("users").update({ is_banned: !isBanned }).eq("telegram_id", telegramId);
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
    toast({ title: t("success") });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border rounded-xl h-10"
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        filtered.map((u) => (
          <div key={u.telegram_id} className="glass-card rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
              {(u.first_name || "U")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold">{u.first_name} {u.last_name}</p>
                {u.is_banned && (
                  <Badge className="bg-destructive/10 text-destructive border-0 text-[9px]">{t("banned")}</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                @{u.username || "—"} • ID: {u.telegram_id} • Lvl {u.level}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => toggleBan(u.telegram_id, u.is_banned)}
            >
              <Ban className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

// TasksView removed — replaced by AdminTasksView component

function CurrenciesView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currencies, isLoading } = useCurrencies();
  const uploadImage = useUploadImage();
  const updateCurrency = useUpdateCurrency();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("currencies").update({ is_active: !isActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["currencies"] });
    toast({ title: t("success") });
  };

  const handleIconUpload = async (id: string, file: File) => {
    setUploadingId(id);
    try {
      const url = await uploadImage.mutateAsync({ file, path: `currencies/${id}` });
      await updateCurrency.mutateAsync({ id, data: { icon_url: url } });
      toast({ title: t("success") });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        (currencies || []).map((c) => (
          <div key={c.id} className="glass-card rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-3">
              {/* Icon preview + upload */}
              <div className="relative group">
                {c.icon_url ? (
                  <img src={c.icon_url} alt={c.symbol} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                    {c.symbol[0]}
                  </div>
                )}
                <button
                  onClick={() => fileInputRefs.current[c.id]?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={uploadingId === c.id}
                >
                  {uploadingId === c.id ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-white" />
                  )}
                </button>
                <input
                  ref={(el) => { fileInputRefs.current[c.id] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleIconUpload(c.id, file);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {c.symbol} • {t("exchangeRate")}: {c.exchange_rate}
                </p>
                {!c.icon_url && (
                  <button
                    onClick={() => fileInputRefs.current[c.id]?.click()}
                    className="text-[10px] text-primary flex items-center gap-0.5 mt-0.5"
                  >
                    <Upload className="w-2.5 h-2.5" /> رفع أيقونة / Upload icon
                  </button>
                )}
              </div>
              <Switch
                checked={c.is_active}
                onCheckedChange={() => toggleActive(c.id, c.is_active)}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

