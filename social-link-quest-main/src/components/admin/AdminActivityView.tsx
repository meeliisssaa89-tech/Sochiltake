import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting, useActivityFeed, useDeleteActivityItem } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Plus, Trash2, Trophy, LayoutList, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Achievement {
  id: string;
  title_en: string; title_ar: string;
  desc_en: string;  desc_ar: string;
  goal_type: string; goal_value: number;
  reward_label: string; is_active: boolean;
}

const GOAL_TYPES = [
  { value: "tasks_completed", label: "Tasks Completed" },
  { value: "referrals",       label: "Referrals" },
  { value: "checkin_streak",  label: "Check-in Streak" },
  { value: "ads_watched",     label: "Ads Watched" },
  { value: "spins",           label: "Spins" },
];

const TYPE_COLORS: Record<string, string> = {
  task_completion: "bg-green-400/10 text-green-400",
  referral:        "bg-blue-400/10 text-blue-400",
  ad_watched:      "bg-primary/10 text-primary",
  spin:            "bg-accent/10 text-accent",
  checkin:         "bg-orange-400/10 text-orange-400",
  promo_redeemed:  "bg-purple-400/10 text-purple-400",
  default:         "bg-secondary text-muted-foreground",
};

const emptyAch: Achievement = {
  id: crypto.randomUUID(),
  title_en: "", title_ar: "", desc_en: "", desc_ar: "",
  goal_type: "tasks_completed", goal_value: 10,
  reward_label: "100 PTS", is_active: true,
};

export function AdminActivityView() {
  const [tab, setTab] = useState<"achievements" | "feed">("achievements");
  const { data: settings } = useAppSettings();
  const update = useUpdateSetting();
  const { toast } = useToast();

  // Achievements state
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [saving, setSaving] = useState(false);

  // Feed state
  const [feedFilter, setFeedFilter] = useState<string>("all");
  const { data: feedItems = [], isLoading: feedLoading, refetch: refetchFeed } = useActivityFeed(undefined, 100);
  const deleteFeed = useDeleteActivityItem();

  useEffect(() => {
    if (!settings?.activity_achievements) return;
    if (Array.isArray(settings.activity_achievements))
      setAchievements(settings.activity_achievements as Achievement[]);
  }, [settings]);

  const addAch    = () => setAchievements([...achievements, { ...emptyAch, id: crypto.randomUUID() }]);
  const removeAch = (id: string) => setAchievements(achievements.filter((a) => a.id !== id));
  const updateAch = (id: string, field: keyof Achievement, value: any) =>
    setAchievements(achievements.map((a) => a.id === id ? { ...a, [field]: value } : a));

  const saveAll = async () => {
    setSaving(true);
    try {
      await update.mutateAsync({ key: "activity_achievements", value: achievements });
      toast({ title: "Achievements saved ✓" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeed.mutateAsync(id);
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const feedTypes = ["all", ...Array.from(new Set((feedItems as any[]).map((i) => i.type)))];
  const filteredFeed = feedFilter === "all"
    ? (feedItems as any[])
    : (feedItems as any[]).filter((i) => i.type === feedFilter);

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex bg-secondary rounded-xl p-1 gap-1">
        {([
          { id: "achievements", icon: Trophy,     label: "Achievements" },
          { id: "feed",         icon: LayoutList, label: "Activity Feed" },
        ] as const).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === tb.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <tb.icon className="w-3 h-3" />
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Achievements ── */}
      {tab === "achievements" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">Configure achievements shown in the Activity tab.</p>
            <Button size="sm" variant="outline" onClick={addAch} className="h-8 text-xs">
              <Plus className="w-3 h-3 me-1" /> Add
            </Button>
          </div>

          {achievements.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No achievements yet. Click Add to create one.
            </div>
          )}

          {achievements.map((ach) => (
            <div key={ach.id} className="glass-card rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{ach.title_en || ach.title_ar || "New Achievement"}</span>
                <div className="flex items-center gap-2">
                  <Switch checked={ach.is_active} onCheckedChange={(v) => updateAch(ach.id, "is_active", v)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAch(ach.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Title (EN)</label>
                  <Input value={ach.title_en} onChange={(e) => updateAch(ach.id, "title_en", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">العنوان (AR)</label>
                  <Input value={ach.title_ar} onChange={(e) => updateAch(ach.id, "title_ar", e.target.value)} className="h-7 text-xs" dir="rtl" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Desc (EN)</label>
                  <Input value={ach.desc_en} onChange={(e) => updateAch(ach.id, "desc_en", e.target.value)} className="h-7 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">الوصف (AR)</label>
                  <Input value={ach.desc_ar} onChange={(e) => updateAch(ach.id, "desc_ar", e.target.value)} className="h-7 text-xs" dir="rtl" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Goal Type</label>
                  <Select value={ach.goal_type} onValueChange={(v) => updateAch(ach.id, "goal_type", v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_TYPES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Goal Value</label>
                  <Input type="number" value={ach.goal_value} onChange={(e) => updateAch(ach.id, "goal_value", +e.target.value)} className="h-7 text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">Reward Label (display only)</label>
                  <Input value={ach.reward_label} onChange={(e) => updateAch(ach.id, "reward_label", e.target.value)} className="h-7 text-xs" placeholder="e.g. 500 PTS" />
                </div>
              </div>
            </div>
          ))}

          <Button onClick={saveAll} disabled={saving} className="w-full h-9 text-xs">
            {saving ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
            Save All Achievements
          </Button>
        </>
      )}

      {/* ── Feed Viewer ── */}
      {tab === "feed" && (
        <>
          <div className="flex items-center gap-2">
            <select
              value={feedFilter}
              onChange={(e) => setFeedFilter(e.target.value)}
              className="flex-1 h-8 text-xs rounded-lg border border-border bg-card px-2"
            >
              {feedTypes.map((t) => (
                <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => refetchFeed()} className="h-8 w-8">
              <RefreshCw className={`w-3 h-3 ${feedLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground">
            {filteredFeed.length} entries
          </div>

          {feedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFeed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">No activity entries found.</div>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {filteredFeed.map((item: any) => {
                const colorClass = TYPE_COLORS[item.type] || TYPE_COLORS.default;
                const time = (() => {
                  try {
                    return formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
                  } catch {
                    return item.created_at;
                  }
                })();
                return (
                  <div key={item.id} className="glass-card rounded-lg p-2.5 flex items-start gap-2">
                    <Badge className={`text-[8px] shrink-0 border-0 mt-0.5 ${colorClass}`}>
                      {item.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] truncate">{item.message}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {item.user_id} · {time}
                      </p>
                    </div>
                    {item.meta?.reward && (
                      <span className="text-[10px] text-accent shrink-0">+{item.meta.reward}</span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
