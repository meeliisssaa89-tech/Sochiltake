import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAllUsers, useAllTasks, useCurrencies, usePlatformStats, useUploadImage, useUpdateCurrency, useCreateCurrency } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { adminAction, signInWithGoogle, signOut } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminAdsView } from "@/components/admin/AdminAdsView";
import { AdminIconsView } from "@/components/admin/AdminIconsView";
import { AdminBroadcastView } from "@/components/admin/AdminBroadcastView";
import { AdminSettingsView } from "@/components/admin/AdminSettingsView";
import { AdminTasksView } from "@/components/admin/AdminTasksView";
import { AdminSpinView } from "@/components/admin/AdminSpinView";
import { AdminWalletView } from "@/components/admin/AdminWalletView";
import { AdminWithdrawalsView } from "@/components/admin/AdminWithdrawalsView";
import { AdminActivityView } from "@/components/admin/AdminActivityView";
import { AdminPromoCodesView } from "@/components/admin/AdminPromoCodesView";
import { AdminBotView } from "@/components/admin/AdminBotView";
import { AdminShortlinkView } from "@/components/admin/AdminShortlinkView";
import { AdminTournamentView } from "@/components/admin/AdminTournamentView";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  LayoutDashboard, Users, ListChecks, Coins, Settings, Search, Ban, ArrowLeft,
  TrendingUp, DollarSign, CheckCircle2, UserPlus, Image as ImageIcon, Send,
  Sparkles, Wallet, Upload, Loader2, Trophy, Tag, Bot, ExternalLink,
  X, Plus, Minus, Trash2, Activity, Star, Shield, ChevronRight, Swords,
} from "lucide-react";

type AdminTab = "dashboard" | "users" | "tasks" | "currencies" | "ads" | "spin" | "wallet" | "icons" | "broadcast" | "settings" | "withdrawals" | "activity" | "promo" | "bot" | "shortlink" | "tournament";

export function AdminPanel() {
  const [session, setSession] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      setAdminEmail("");
      return;
    }
    adminAction<{ ok: boolean; email: string }>("whoami")
      .then((r) => { setIsAdmin(true); setAdminEmail(r.email); setAuthError(""); })
      .catch((e) => { setIsAdmin(false); setAuthError(e.message); });
  }, [session]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 text-center glass-card rounded-2xl p-6 border border-primary/10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Admin sign-in</h1>
            <p className="text-xs text-muted-foreground">Restricted area. Sign in with an authorised Google account to continue.</p>
          </div>
          <Button
            className="w-full h-10 rounded-xl text-sm gap-2"
            disabled={signingIn}
            onClick={async () => {
              setSigningIn(true);
              try { await signInWithGoogle(); } catch (e: any) { setAuthError(e.message); }
              finally { setSigningIn(false); }
            }}
          >
            {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue with Google</>}
          </Button>
          {authError && <p className="text-[11px] text-destructive">{authError}</p>}
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 text-center glass-card rounded-2xl p-6 border border-destructive/30">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 mx-auto flex items-center justify-center">
            <Ban className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-lg font-bold">Access denied</h1>
          <p className="text-xs text-muted-foreground">{authError || "Your Google account is not on the admin allowlist."}</p>
          <p className="text-[11px] text-muted-foreground break-all">Signed in as <b>{session.user?.email}</b></p>
          <Button variant="outline" className="w-full h-9 rounded-xl text-xs" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return <AdminPanelInner adminEmail={adminEmail} />;
}

function AdminPanelInner({ adminEmail }: { adminEmail: string }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab | "admins">("dashboard");
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
    { id: "activity" as const, icon: Trophy, label: t("activityManagement") },
    { id: "promo" as const, icon: Tag, label: t("promoManagement") },
    { id: "icons" as const, icon: ImageIcon, label: t("appearance") },
    { id: "broadcast" as const, icon: Send, label: t("broadcast") },
    { id: "bot" as const, icon: Bot, label: t("bot") },
    { id: "shortlink" as const, icon: ExternalLink, label: "Shortlink" },
    { id: "tournament" as const, icon: Swords, label: "Tournaments" },
    { id: "settings" as const, icon: Settings, label: t("settings") },
    { id: "admins" as const, icon: Shield, label: "Admin Access" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            </a>
            <h1 className="text-lg font-bold gradient-text-cyan truncate">{t("admin")}</h1>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={adminEmail}>{adminEmail}</span>
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded-lg" onClick={signOut}>Sign out</Button>
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
        {activeTab === "activity" && <AdminActivityView />}
        {activeTab === "promo" && <AdminPromoCodesView />}
        {activeTab === "icons" && <AdminIconsView />}
        {activeTab === "broadcast" && <AdminBroadcastView />}
        {activeTab === "bot" && <AdminBotView />}
        {activeTab === "shortlink" && <AdminShortlinkView />}
        {activeTab === "tournament" && <AdminTournamentView />}
        {activeTab === "settings" && <AdminSettingsView />}
        {activeTab === "admins" && <AdminAccessView currentEmail={adminEmail} />}
      </div>
    </div>
  );
}

function DashboardView() {
  const { t } = useLanguage();
  const { data: stats } = usePlatformStats();
  const { data: allUsers } = useAllUsers();

  const { data: userTasks } = useQuery({
    queryKey: ["admin-user-tasks-all"],
    queryFn: async () => {
      const { data } = await supabase.from("user_tasks").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: adWatches } = useQuery({
    queryKey: ["admin-ad-watches-all"],
    queryFn: async () => {
      const { data } = await supabase.from("ad_watches").select("*").order("watched_at", { ascending: false }).limit(500);
      return data || [];
    },
    staleTime: 60_000,
  });

  const today = new Date().toISOString().split("T")[0];
  const activeToday = allUsers?.filter((u) => u.updated_at?.startsWith(today)).length || 0;
  const newToday = allUsers?.filter((u) => u.created_at?.startsWith(today)).length || 0;
  const tasksToday = userTasks?.filter((ut) => ut.created_at?.startsWith(today)).length || 0;
  const adsToday = adWatches?.filter((a) => (a.watched_at || "").startsWith(today)).length || 0;

  const dashStats = [
    { icon: Users, label: t("totalUsers"), value: stats?.totalUsers?.toLocaleString() || "0", color: "text-primary" },
    { icon: UserPlus, label: t("activeUsers"), value: String(activeToday), color: "text-success" },
    { icon: CheckCircle2, label: t("tasksCompleted"), value: stats?.totalCompleted?.toLocaleString() || "0", color: "text-accent" },
    { icon: TrendingUp, label: t("adsToday"), value: String(adsToday), color: "text-yellow-500" },
  ];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en", { weekday: "short" });
    const users = allUsers?.filter((u) => u.updated_at?.startsWith(key)).length || 0;
    const tasks = userTasks?.filter((ut) => ut.created_at?.startsWith(key)).length || 0;
    const ads = adWatches?.filter((a) => (a.watched_at || "").startsWith(key)).length || 0;
    return { label, users, tasks, ads };
  });

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

      {/* Today summary */}
      <div className="glass-card rounded-xl p-3">
        <p className="text-xs font-semibold mb-3 text-muted-foreground">Today's Activity</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums text-primary">{newToday}</p>
            <p className="text-[9px] text-muted-foreground">New Users</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-accent">{tasksToday}</p>
            <p className="text-[9px] text-muted-foreground">Tasks Done</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-yellow-500">{adsToday}</p>
            <p className="text-[9px] text-muted-foreground">Ads Watched</p>
          </div>
        </div>
      </div>

      {/* 7-day activity bar chart */}
      <div className="glass-card rounded-xl p-3">
        <p className="text-xs font-semibold mb-3">Active Users — Last 7 Days</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Users" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 7-day tasks + ads chart */}
      <div className="glass-card rounded-xl p-3">
        <p className="text-xs font-semibold mb-3">Tasks & Ads — Last 7 Days</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={last7} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar dataKey="tasks" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Tasks" />
            <Bar dataKey="ads" fill="#eab308" radius={[4, 4, 0, 0]} name="Ads" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 mt-2 justify-center">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-accent" /><span className="text-[9px] text-muted-foreground">Tasks</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-yellow-500" /><span className="text-[9px] text-muted-foreground">Ads</span></div>
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ user: u, onClose }: { user: any; onClose: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adjustCurrencyId, setAdjustCurrencyId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMode, setAdjustMode] = useState<"add" | "remove">("add");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: balances } = useQuery({
    queryKey: ["admin-user-balances", u.telegram_id],
    queryFn: async () => {
      const { data } = await supabase.from("balances").select("*, currencies(*)").eq("user_id", u.telegram_id);
      return data || [];
    },
  });

  const { data: recentTasks } = useQuery({
    queryKey: ["admin-user-tasks", u.telegram_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_tasks")
        .select("*, tasks(title, reward_amount)")
        .eq("user_id", u.telegram_id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // ── Forensics: lifetime activity counts to spot abuse ───────────────
  const { data: forensics } = useQuery({
    queryKey: ["admin-user-forensics", u.telegram_id],
    queryFn: async () => {
      const uid = u.telegram_id;
      const todayStr = new Date().toISOString().split("T")[0];
      const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

      const [
        adsAll, adsToday, adsWeek,
        tasksAll, tasksToday,
        refsAll, refsToday,
        checkinsAll,
        spinsAll, spinsToday,
        withdrawalsAll,
        recentAds,
        recentReferrals,
      ] = await Promise.all([
        supabase.from("ad_watches").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("ad_watches").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("watch_date", todayStr),
        supabase.from("ad_watches").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", since7),
        supabase.from("user_tasks").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "completed"),
        supabase.from("user_tasks").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "completed").gte("created_at", todayStr),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("inviter_id", uid),
        supabase.from("referrals").select("id", { count: "exact", head: true }).eq("inviter_id", uid).gte("created_at", todayStr),
        supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("spin_history").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("spin_history").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("spin_date", todayStr),
        supabase.from("withdrawals").select("id, amount, status, created_at, currencies(symbol)").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
        supabase.from("ad_watches").select("created_at, slot_index, reward_amount").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
        supabase.from("referrals").select("invitee_id, created_at, users!referrals_invitee_id_fkey(first_name, username, telegram_id, created_at)").eq("inviter_id", uid).order("created_at", { ascending: false }).limit(20),
      ]);

      // Detect suspicious patterns: many referrals on the same day with brand-new accounts.
      const refRows: any[] = (recentReferrals.data as any) || [];
      const sameDayRefs = refRows.filter((r) => {
        const inviteeCreated = r.users?.created_at;
        if (!inviteeCreated) return false;
        return Math.abs(new Date(r.created_at).getTime() - new Date(inviteeCreated).getTime()) < 5 * 60_000;
      }).length;

      return {
        adsAll: adsAll.count || 0,
        adsToday: adsToday.count || 0,
        adsWeek: adsWeek.count || 0,
        tasksAll: tasksAll.count || 0,
        tasksToday: tasksToday.count || 0,
        refsAll: refsAll.count || 0,
        refsToday: refsToday.count || 0,
        checkinsAll: checkinsAll.count || 0,
        spinsAll: spinsAll.count || 0,
        spinsToday: spinsToday.count || 0,
        withdrawals: (withdrawalsAll.data as any[]) || [],
        recentAds: (recentAds.data as any[]) || [],
        recentReferrals: refRows,
        sameDayRefs,
      };
    },
  });

  const handleBan = async () => {
    try {
      await adminAction("set_banned", { userId: u.telegram_id, banned: !u.is_banned });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({ title: t("success") });
      onClose();
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustCurrencyId || !adjustAmount) return;
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) return;
    try {
      await adminAction("adjust_balance", {
        userId: u.telegram_id,
        currencyId: adjustCurrencyId,
        amount: amt,
        mode: adjustMode,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-user-balances", u.telegram_id] });
      queryClient.invalidateQueries({ queryKey: ["balances", u.telegram_id] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast({ title: t("success"), description: `${adjustMode === "add" ? "+" : "-"}${amt}` });
      setAdjustAmount("");
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setIsDeleting(true);
    try {
      await adminAction("delete_user", { userId: u.telegram_id });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast({ title: "User deleted" });
      onClose();
    } catch (err: any) {
      toast({ title: t("error"), description: err.message || "Delete failed", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-card rounded-t-3xl p-4 space-y-4 max-h-[90vh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-border mx-auto" />

        {/* Header */}
        <div className="flex items-center gap-3">
          {u.photo_url ? (
            <img src={u.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">
              {(u.first_name || "U")[0]}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold">{u.first_name} {u.last_name}</p>
              {u.is_banned && <Badge className="bg-destructive/10 text-destructive border-0 text-[9px]">{t("banned")}</Badge>}
            </div>
            <p className="text-[11px] text-muted-foreground">@{u.username || "—"} • {u.telegram_id}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5"><Star className="w-3 h-3 text-primary" /></div>
            <p className="text-sm font-bold">{u.level || 1}</p>
            <p className="text-[9px] text-muted-foreground">{t("level")}</p>
          </div>
          <div className="glass-card rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5"><Activity className="w-3 h-3 text-accent" /></div>
            <p className="text-sm font-bold">{(u.exp || 0).toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">{t("exp")}</p>
          </div>
          <div className="glass-card rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5"><Shield className="w-3 h-3 text-yellow-500" /></div>
            <p className="text-sm font-bold">{u.streak || 0}</p>
            <p className="text-[9px] text-muted-foreground">{t("streak")}</p>
          </div>
        </div>

        {/* Balances */}
        {balances && balances.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2">{t("appBalances")}</p>
            <div className="space-y-1.5">
              {balances.map((b: any) => {
                const cur = b.currencies;
                const iconUrl = cur?.icon_url || (cur?.symbol === "TON" ? "https://ton.org/icons/ton_symbol.svg" : null);
                return (
                  <div key={b.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                    {iconUrl ? (
                      <img src={iconUrl} alt={cur?.symbol} className="w-8 h-8 rounded-full bg-secondary p-0.5 shrink-0 object-contain" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {cur?.symbol?.[0] || "?"}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cur?.name}</p>
                      <p className="text-[10px] text-muted-foreground">{cur?.symbol}</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums">{Number(b.amount).toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Balance Adjustment */}
        {balances && balances.length > 0 && (
          <div className="glass-card rounded-xl p-3 space-y-2 border border-primary/10">
            <p className="text-xs font-semibold">Adjust Balance</p>
            <div className="flex gap-1.5">
              {balances.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setAdjustCurrencyId(b.currency_id)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                    adjustCurrencyId === b.currency_id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {b.currencies?.symbol}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setAdjustMode("add")}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                  adjustMode === "add" ? "border-success bg-success/10 text-success" : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                <Plus className="w-3 h-3" /> Add
              </button>
              <button
                onClick={() => setAdjustMode("remove")}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                  adjustMode === "remove" ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                <Minus className="w-3 h-3" /> Remove
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="flex-1 h-8 text-xs bg-secondary border-border rounded-xl"
              />
              <Button size="sm" onClick={handleAdjustBalance} className="h-8 px-3 text-xs rounded-xl" disabled={!adjustCurrencyId || !adjustAmount}>
                Apply
              </Button>
            </div>
          </div>
        )}

        {/* ── Activity forensics ── */}
        {forensics && (
          <div className="space-y-2">
            <p className="text-xs font-semibold">Activity Forensics</p>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="glass-card rounded-lg p-2">
                <p className="text-sm font-bold tabular-nums text-primary">{forensics.tasksAll}</p>
                <p className="text-[8px] text-muted-foreground">Tasks (today {forensics.tasksToday})</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-sm font-bold tabular-nums text-yellow-500">{forensics.adsAll}</p>
                <p className="text-[8px] text-muted-foreground">Ads (today {forensics.adsToday} • 7d {forensics.adsWeek})</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-sm font-bold tabular-nums text-blue-400">{forensics.refsAll}</p>
                <p className="text-[8px] text-muted-foreground">Refs (today {forensics.refsToday})</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-sm font-bold tabular-nums text-orange-400">{forensics.checkinsAll}</p>
                <p className="text-[8px] text-muted-foreground">Check-ins</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-sm font-bold tabular-nums text-accent">{forensics.spinsAll}</p>
                <p className="text-[8px] text-muted-foreground">Spins (today {forensics.spinsToday})</p>
              </div>
              <div className="glass-card rounded-lg p-2">
                <p className="text-sm font-bold tabular-nums text-purple-400">{forensics.withdrawals.length}</p>
                <p className="text-[8px] text-muted-foreground">Withdraw req.</p>
              </div>
            </div>

            {/* Abuse warnings */}
            {(forensics.sameDayRefs >= 3 || forensics.adsToday > 50 || forensics.refsToday > 20) && (
              <div className="rounded-lg p-2 bg-destructive/10 border border-destructive/30 text-[10px] text-destructive space-y-0.5">
                <p className="font-semibold">⚠ Suspicious activity</p>
                {forensics.sameDayRefs >= 3 && (
                  <p>• {forensics.sameDayRefs} referrals where the invitee account was created within minutes of being invited.</p>
                )}
                {forensics.adsToday > 50 && <p>• Unusually high ad watches today ({forensics.adsToday}).</p>}
                {forensics.refsToday > 20 && <p>• Unusually high referrals today ({forensics.refsToday}).</p>}
              </div>
            )}

            {/* Recent referrals */}
            {forensics.recentReferrals.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Recent referrals</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {forensics.recentReferrals.map((r: any, i: number) => {
                    const inv = r.users;
                    const fast = inv?.created_at && Math.abs(new Date(r.created_at).getTime() - new Date(inv.created_at).getTime()) < 5 * 60_000;
                    return (
                      <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded text-[10px] ${fast ? "bg-destructive/10" : "bg-secondary/40"}`}>
                        <span className="flex-1 truncate">{inv?.first_name || inv?.username || r.invitee_id}</span>
                        <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                        {fast && <span className="text-destructive">⚡fast</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent withdrawals */}
            {forensics.withdrawals.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Withdrawals</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {forensics.withdrawals.map((w: any) => (
                    <div key={w.id} className="flex items-center gap-2 py-1 px-2 rounded text-[10px] bg-secondary/40">
                      <span className="flex-1">{Number(w.amount)} {w.currencies?.symbol || ""}</span>
                      <span className={`px-1.5 rounded ${
                        w.status === "approved" ? "bg-success/20 text-success" :
                        w.status === "rejected" ? "bg-destructive/20 text-destructive" :
                        "bg-yellow-500/20 text-yellow-600"
                      }`}>{w.status}</span>
                      <span className="text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent ad timeline (anti-fraud signal) */}
            {forensics.recentAds.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Last ads watched</p>
                <div className="space-y-0.5 max-h-28 overflow-y-auto">
                  {forensics.recentAds.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 px-2 rounded text-[10px] bg-secondary/40">
                      <span className="flex-1">slot #{a.slot_index}</span>
                      <span className="text-accent">+{Number(a.reward_amount)}</span>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
        {recentTasks && recentTasks.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2">Recent Tasks</p>
            <div className="space-y-1">
              {recentTasks.slice(0, 5).map((ut: any) => (
                <div key={ut.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                  <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                  <p className="text-[11px] flex-1 truncate">{ut.tasks?.title || "Task"}</p>
                  <p className="text-[9px] text-muted-foreground">{new Date(ut.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className={`flex-1 h-9 text-xs rounded-xl border ${u.is_banned ? "border-success text-success" : "border-yellow-500 text-yellow-600"}`}
            onClick={handleBan}
          >
            <Ban className="w-3.5 h-3.5 me-1" />
            {u.is_banned ? t("unban") : t("ban")}
          </Button>
          <Button
            variant="outline"
            className={`flex-1 h-9 text-xs rounded-xl border ${confirmDelete ? "border-destructive bg-destructive text-white" : "border-destructive text-destructive"}`}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 me-1" />
                {confirmDelete ? "Confirm Delete" : "Delete User"}
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function UsersView({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const { t } = useLanguage();
  const { data: users, isLoading } = useAllUsers();
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const filtered = (users || []).filter((u) => {
    const s = search.toLowerCase();
    return (
      (u.username || "").toLowerCase().includes(s) ||
      (u.first_name || "").toLowerCase().includes(s) ||
      u.telegram_id.includes(s)
    );
  });

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
          <button
            key={u.telegram_id}
            className="w-full glass-card rounded-xl p-3 flex items-center gap-3 text-left hover:border-primary/20 transition-colors"
            onClick={() => setSelectedUser(u)}
          >
            {u.photo_url ? (
              <img src={u.photo_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold shrink-0">
                {(u.first_name || "U")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold truncate">{u.first_name} {u.last_name}</p>
                {u.is_banned && (
                  <Badge className="bg-destructive/10 text-destructive border-0 text-[9px] shrink-0">{t("banned")}</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                @{u.username || "—"} • Lvl {u.level} • {(u.exp || 0).toLocaleString()} EXP
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))
      )}

      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// TasksView removed — replaced by AdminTasksView component

const DEFAULT_CURRENCIES = [
  {
    name: "Toncoin",
    symbol: "TON",
    exchange_rate: 3.2,
    decimals: 9,
    icon_url: "https://ton.org/icons/ton_symbol.svg",
  },
  {
    name: "Tether USD",
    symbol: "USDT",
    exchange_rate: 1.0,
    decimals: 6,
    icon_url: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040",
  },
];

function CurrenciesView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currencies, isLoading } = useCurrencies();
  const uploadImage = useUploadImage();
  const updateCurrency = useUpdateCurrency();
  const createCurrency = useCreateCurrency();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCurrency, setNewCurrency] = useState({ name: "", symbol: "", exchange_rate: 1.0 });

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

  const handleAddCurrency = async () => {
    if (!newCurrency.name.trim() || !newCurrency.symbol.trim()) {
      toast({ title: t("error"), description: "Name and symbol are required", variant: "destructive" });
      return;
    }
    try {
      await createCurrency.mutateAsync({
        name: newCurrency.name.trim(),
        symbol: newCurrency.symbol.trim().toUpperCase(),
        exchange_rate: newCurrency.exchange_rate,
      });
      toast({ title: t("success"), description: `${newCurrency.symbol.toUpperCase()} added` });
      setNewCurrency({ name: "", symbol: "", exchange_rate: 1.0 });
      setShowAddForm(false);
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const handleQuickAdd = async (preset: typeof DEFAULT_CURRENCIES[0]) => {
    const exists = (currencies || []).some((c) => c.symbol === preset.symbol);
    if (exists) {
      toast({ title: "Already exists", description: `${preset.symbol} is already in the list` });
      return;
    }
    try {
      await createCurrency.mutateAsync(preset);
      toast({ title: t("success"), description: `${preset.symbol} added` });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick Add: TON & USDT */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Quick Add</p>
        <div className="flex gap-2 flex-wrap">
          {DEFAULT_CURRENCIES.map((preset) => {
            const exists = (currencies || []).some((c) => c.symbol === preset.symbol);
            return (
              <button
                key={preset.symbol}
                onClick={() => handleQuickAdd(preset)}
                disabled={exists || createCurrency.isPending}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  exists
                    ? "border-success/30 text-success bg-success/5 cursor-default"
                    : "border-primary/40 text-primary hover:bg-primary/10"
                }`}
              >
                <img src={preset.icon_url} alt={preset.symbol} className="w-4 h-4 rounded-full" />
                {preset.symbol}
                {exists && " ✓"}
              </button>
            );
          })}
          <button
            onClick={() => setShowAddForm((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:bg-secondary transition-all"
          >
            + Custom
          </button>
        </div>

        {/* Custom add form */}
        {showAddForm && (
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Name</label>
                <Input
                  value={newCurrency.name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, name: e.target.value })}
                  placeholder="Toncoin"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Symbol</label>
                <Input
                  value={newCurrency.symbol}
                  onChange={(e) => setNewCurrency({ ...newCurrency, symbol: e.target.value })}
                  placeholder="TON"
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Rate (USD)</label>
                <Input
                  type="number"
                  value={newCurrency.exchange_rate}
                  onChange={(e) => setNewCurrency({ ...newCurrency, exchange_rate: +e.target.value })}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAddCurrency}
              disabled={createCurrency.isPending}
              className="w-full h-8 text-xs"
            >
              {createCurrency.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add Currency"}
            </Button>
          </div>
        )}
      </div>

      {/* Existing currencies */}
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

            {/* Withdrawal rules */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/40">
              <div>
                <label className="text-[9px] text-muted-foreground">Rate (USD)</label>
                <Input
                  type="number"
                  step="any"
                  defaultValue={c.exchange_rate ?? 1}
                  onBlur={async (e) => {
                    await updateCurrency.mutateAsync({ id: c.id, data: { exchange_rate: +e.target.value } as any });
                    toast({ title: t("success") });
                  }}
                  className="h-7 text-xs mt-0.5"
                  data-testid={`input-rate-${c.id}`}
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Min withdraw</label>
                <Input
                  type="number"
                  step="any"
                  defaultValue={(c as any).min_withdraw_amount ?? 0}
                  onBlur={async (e) => {
                    await updateCurrency.mutateAsync({ id: c.id, data: { min_withdraw_amount: +e.target.value } as any });
                    toast({ title: t("success") });
                  }}
                  className="h-7 text-xs mt-0.5"
                  data-testid={`input-min-${c.id}`}
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Max withdraw (0 = none)</label>
                <Input
                  type="number"
                  step="any"
                  defaultValue={(c as any).max_withdraw_amount ?? 0}
                  onBlur={async (e) => {
                    const v = +e.target.value;
                    await updateCurrency.mutateAsync({ id: c.id, data: { max_withdraw_amount: v > 0 ? v : null } as any });
                    toast({ title: t("success") });
                  }}
                  className="h-7 text-xs mt-0.5"
                  data-testid={`input-max-${c.id}`}
                />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground">Required referrals</label>
                <Input
                  type="number"
                  defaultValue={(c as any).required_referrals ?? 0}
                  onBlur={async (e) => {
                    await updateCurrency.mutateAsync({ id: c.id, data: { required_referrals: +e.target.value } as any });
                    toast({ title: t("success") });
                  }}
                  className="h-7 text-xs mt-0.5"
                  data-testid={`input-refs-${c.id}`}
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}


function AdminAccessView({ currentEmail }: { currentEmail: string }) {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<Array<{ email: string; created_at: string }>>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await adminAction<{ admins: any[] }>("list_admins");
      setAdmins(r.admins || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const add = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    try {
      await adminAction("add_admin", { email });
      setNewEmail("");
      await refresh();
      toast({ title: "Admin added" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const remove = async (email: string) => {
    if (!confirm(`Remove ${email} from admins?`)) return;
    try {
      await adminAction("remove_admin", { email });
      await refresh();
      toast({ title: "Admin removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 space-y-2 border border-primary/10">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Admin allowlist</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Only Google accounts in this list can sign into the admin panel. You are signed in as <b>{currentEmail}</b>.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-3 space-y-2">
        <p className="text-xs font-semibold">Add admin email</p>
        <div className="flex gap-2">
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="person@gmail.com"
            className="h-9 text-xs rounded-xl"
            type="email"
          />
          <Button size="sm" onClick={add} disabled={busy || !newEmail.trim()} className="rounded-xl h-9 text-xs px-4">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold px-1">Authorised admins</p>
        {loading ? (
          <Skeleton className="h-12 rounded-xl" />
        ) : admins.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">No admins yet</p>
        ) : (
          admins.map((a) => (
            <div key={a.email} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.email}</p>
                <p className="text-[10px] text-muted-foreground">
                  added {new Date(a.created_at).toLocaleDateString()}
                  {a.email === currentEmail && <span className="ms-1 text-primary">• you</span>}
                </p>
              </div>
              {a.email !== currentEmail && (
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[10px] rounded-lg border-destructive/30 text-destructive"
                  onClick={() => remove(a.email)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
