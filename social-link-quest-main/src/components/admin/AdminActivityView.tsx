import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Plus, Trash2, Trophy } from "lucide-react";

interface Achievement {
  id: string;
  title_en: string;
  title_ar: string;
  desc_en: string;
  desc_ar: string;
  goal_type: string;
  goal_value: number;
  reward_label: string;
  is_active: boolean;
}

const GOAL_TYPES = [
  { value: "tasks_completed", label: "Tasks Completed" },
  { value: "referrals", label: "Referrals" },
  { value: "checkin_streak", label: "Check-in Streak" },
  { value: "ads_watched", label: "Ads Watched" },
];

const emptyAch: Achievement = {
  id: crypto.randomUUID(),
  title_en: "", title_ar: "", desc_en: "", desc_ar: "",
  goal_type: "tasks_completed", goal_value: 10,
  reward_label: "100 TON", is_active: true,
};

export function AdminActivityView() {
  const { data: settings } = useAppSettings();
  const update = useUpdateSetting();
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings?.activity_achievements) return;
    const loaded = settings.activity_achievements;
    if (Array.isArray(loaded)) setAchievements(loaded as Achievement[]);
  }, [settings]);

  const addAch = () => setAchievements([...achievements, { ...emptyAch, id: crypto.randomUUID() }]);
  const removeAch = (id: string) => setAchievements(achievements.filter((a) => a.id !== id));
  const updateAch = (id: string, field: keyof Achievement, value: any) =>
    setAchievements(achievements.map((a) => a.id === id ? { ...a, [field]: value } : a));

  const saveAll = async () => {
    setSaving(true);
    try {
      await update.mutateAsync({ key: "activity_achievements", value: achievements });
      toast({ title: "Activity config saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" /> Achievements
        </h3>
        <Button size="sm" variant="outline" onClick={addAch} className="h-8 text-xs">
          <Plus className="w-3 h-3 me-1" /> Add
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Configure achievements shown in the Activity tab.</p>

      {achievements.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          No achievements yet. Click Add to create one.
        </div>
      )}

      {achievements.map((ach) => (
        <div key={ach.id} className="glass-card rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">{ach.title_en || "New Achievement"}</span>
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
              <Input value={ach.title_ar} onChange={(e) => updateAch(ach.id, "title_ar", e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Desc (EN)</label>
              <Input value={ach.desc_en} onChange={(e) => updateAch(ach.id, "desc_en", e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">الوصف (AR)</label>
              <Input value={ach.desc_ar} onChange={(e) => updateAch(ach.id, "desc_ar", e.target.value)} className="h-7 text-xs" />
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
              <Input value={ach.reward_label} onChange={(e) => updateAch(ach.id, "reward_label", e.target.value)} className="h-7 text-xs" placeholder="e.g. 500 TON" />
            </div>
          </div>
        </div>
      ))}

      <Button onClick={saveAll} disabled={saving} className="w-full h-9 text-xs">
        {saving ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
        Save All Achievements
      </Button>
    </div>
  );
}
