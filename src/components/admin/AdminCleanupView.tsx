import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, RefreshCw, AlertTriangle, Database, Zap } from "lucide-react";

interface CleanupStat {
  label: string;
  description: string;
  queryKey: string;
  countFn: () => Promise<number>;
  deleteFn: () => Promise<void>;
  color: string;
}

export function AdminCleanupView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirms, setConfirms] = useState<Record<string, boolean>>({});
  const [cleaningAll, setCleaningAll] = useState(false);

  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const cutoff7  = new Date(Date.now() - 7  * 86400000).toISOString();
  const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const stats: CleanupStat[] = [
    {
      label: "Completed User Tasks (30d+)",
      description: "user_tasks with status=completed older than 30 days",
      queryKey: "cleanup-user-tasks",
      color: "text-yellow-500",
      countFn: async () => {
        const { count } = await supabase
          .from("user_tasks").select("id", { count: "exact", head: true })
          .eq("status", "completed").lt("created_at", cutoff30);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("user_tasks").delete()
          .eq("status", "completed").lt("created_at", cutoff30);
      },
    },
    {
      label: "Used Task Code Sessions (7d+)",
      description: "task_code_sessions that are completed/used, older than 7 days",
      queryKey: "cleanup-code-sessions",
      color: "text-orange-500",
      countFn: async () => {
        const { count } = await supabase
          .from("task_code_sessions").select("id", { count: "exact", head: true })
          .not("completed_at", "is", null).lt("completed_at", cutoff7);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("task_code_sessions").delete()
          .not("completed_at", "is", null).lt("completed_at", cutoff7);
      },
    },
    {
      label: "Old Ad Watch Records (30d+)",
      description: "ad_watches records older than 30 days",
      queryKey: "cleanup-ad-watches",
      color: "text-blue-500",
      countFn: async () => {
        const { count } = await supabase
          .from("ad_watches").select("id", { count: "exact", head: true })
          .lt("watched_at", cutoff30);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("ad_watches").delete().lt("watched_at", cutoff30);
      },
    },
    {
      label: "Old Daily Check-ins (90d+)",
      description: "daily_checkins records older than 90 days",
      queryKey: "cleanup-checkins",
      color: "text-purple-500",
      countFn: async () => {
        const { count } = await supabase
          .from("daily_checkins").select("id", { count: "exact", head: true })
          .lt("check_in_date", cutoff90.split("T")[0]);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("daily_checkins").delete()
          .lt("check_in_date", cutoff90.split("T")[0]);
      },
    },
    {
      label: "Old Spin History (90d+)",
      description: "spin_history records older than 90 days",
      queryKey: "cleanup-spin-history",
      color: "text-pink-500",
      countFn: async () => {
        const { count } = await supabase
          .from("spin_history").select("id", { count: "exact", head: true })
          .lt("created_at", cutoff90);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("spin_history").delete().lt("created_at", cutoff90);
      },
    },
    {
      label: "Old Referral Records (90d+)",
      description: "referrals records older than 90 days",
      queryKey: "cleanup-referrals",
      color: "text-emerald-500",
      countFn: async () => {
        const { count } = await supabase
          .from("referrals").select("id", { count: "exact", head: true })
          .lt("created_at", cutoff90);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("referrals").delete().lt("created_at", cutoff90);
      },
    },
    {
      label: "Old Activity Feed (30d+)",
      description: "activity_feed entries older than 30 days",
      queryKey: "cleanup-activity-feed",
      color: "text-cyan-500",
      countFn: async () => {
        const { count } = await supabase
          .from("activity_feed").select("id", { count: "exact", head: true })
          .lt("created_at", cutoff30);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("activity_feed").delete().lt("created_at", cutoff30);
      },
    },
    {
      label: "Old Broadcast Records (90d+)",
      description: "broadcasts records older than 90 days",
      queryKey: "cleanup-broadcasts",
      color: "text-rose-500",
      countFn: async () => {
        const { count } = await supabase
          .from("broadcasts").select("id", { count: "exact", head: true })
          .lt("created_at", cutoff90);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("broadcasts").delete().lt("created_at", cutoff90);
      },
    },
    {
      label: "Old Shortlink Visits (30d+)",
      description: "shortlink_visits records older than 30 days",
      queryKey: "cleanup-shortlink-visits",
      color: "text-violet-500",
      countFn: async () => {
        const { count } = await supabase
          .from("shortlink_visits").select("id", { count: "exact", head: true })
          .lt("visited_at", cutoff30);
        return count || 0;
      },
      deleteFn: async () => {
        await supabase.from("shortlink_visits").delete().lt("visited_at", cutoff30);
      },
    },
  ];

  const handleDelete = async (stat: CleanupStat) => {
    if (!confirms[stat.queryKey]) {
      setConfirms((p) => ({ ...p, [stat.queryKey]: true }));
      return;
    }
    setDeleting(stat.queryKey);
    try {
      await stat.deleteFn();
      qc.invalidateQueries({ queryKey: [stat.queryKey] });
      setConfirms((p) => ({ ...p, [stat.queryKey]: false }));
      toast({ title: "Deleted", description: `${stat.label} cleaned up.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleCleanAll = async () => {
    if (!confirm("Clean ALL old records from all tables? This cannot be undone.")) return;
    setCleaningAll(true);
    let cleaned = 0;
    let errors = 0;
    for (const stat of stats) {
      try {
        await stat.deleteFn();
        qc.invalidateQueries({ queryKey: [stat.queryKey] });
        cleaned++;
      } catch {
        errors++;
      }
    }
    setCleaningAll(false);
    toast({
      title: `Cleanup complete`,
      description: `${cleaned} tables cleaned${errors ? `, ${errors} failed` : ""}.`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-yellow-500">Data Cleanup</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Delete old records to free up database space. These operations are permanent and cannot be undone.
            Each delete requires a confirmation click.
          </p>
        </div>
      </div>

      {/* Supabase free tier limits */}
      <div className="glass-card rounded-xl p-3 border border-primary/20 space-y-2">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> Supabase Free Tier Limits
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Database", limit: "500 MB" },
            { label: "Storage", limit: "1 GB" },
            { label: "Bandwidth", limit: "5 GB/mo" },
          ].map((item) => (
            <div key={item.label} className="text-center p-2 rounded-lg bg-muted/30 border border-border">
              <p className="text-[11px] font-bold">{item.limit}</p>
              <p className="text-[9px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {stats.map((stat) => (
          <CleanupCard
            key={stat.queryKey}
            stat={stat}
            isDeleting={deleting === stat.queryKey}
            confirmed={confirms[stat.queryKey] || false}
            onDelete={() => handleDelete(stat)}
            onCancel={() => setConfirms((p) => ({ ...p, [stat.queryKey]: false }))}
          />
        ))}
      </div>

      <Button
        variant="destructive"
        className="w-full h-9 text-xs gap-2"
        onClick={handleCleanAll}
        disabled={cleaningAll || !!deleting}
      >
        {cleaningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        {cleaningAll ? "Cleaning all tables…" : "Clean All Old Records (One Click)"}
      </Button>

      <div className="glass-card rounded-xl p-4 flex items-center gap-3 border border-destructive/20">
        <Database className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">Monitor Supabase Usage</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Check database size in Supabase Dashboard → Project Settings → Database.
            Free tier limit: 500 MB.
          </p>
        </div>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded-lg">
            Open Dashboard
          </Button>
        </a>
      </div>
    </div>
  );
}

function CleanupCard({
  stat,
  isDeleting,
  confirmed,
  onDelete,
  onCancel,
}: {
  stat: CleanupStat;
  isDeleting: boolean;
  confirmed: boolean;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { data: count, isLoading, refetch } = useQuery({
    queryKey: [stat.queryKey],
    queryFn: stat.countFn,
    staleTime: 30_000,
  });

  return (
    <div className="glass-card rounded-xl p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{stat.label}</p>
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <span className={`text-xs font-bold tabular-nums ${stat.color}`}>
              {(count ?? 0).toLocaleString()} rows
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{stat.description}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => refetch()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh count"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        {confirmed ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px] px-2 rounded-lg"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[10px] px-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={onDelete}
              disabled={isDeleting || (count ?? 0) === 0}
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Delete"}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onDelete}
            disabled={isDeleting || (count ?? 0) === 0}
          >
            <Trash2 className="w-3 h-3 me-1" />
            Clean
          </Button>
        )}
      </div>
    </div>
  );
}
