import { useState, useRef } from "react";
import { useAllTasks, useCurrencies, useUploadImage } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AppIcon } from "@/components/AppIcon";
import { Plus, Trash2, Save, Edit2, X, Upload, Loader2, Star } from "lucide-react";

interface TaskForm {
  id?: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  type: "telegram_join" | "watch_ad" | "social_link";
  reward_amount: number;
  reward_currency_id: string | null;
  xp_reward: number;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  icon_url: string;
  metadata: Record<string, any>;
}

const empty: TaskForm = {
  title_en: "", title_ar: "", description_en: "", description_ar: "",
  type: "telegram_join", reward_amount: 100, reward_currency_id: null,
  xp_reward: 10, is_active: true, is_required: false, sort_order: 0,
  icon_url: "", metadata: {},
};

export function AdminTasksView() {
  const { data: tasks, isLoading } = useAllTasks();
  const { data: currencies } = useCurrencies();
  const qc = useQueryClient();
  const { toast } = useToast();
  const uploadImage = useUploadImage();
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<TaskForm | null>(null);
  const [showForm, setShowForm] = useState(false);

  const reset = () => { setEditing(null); setShowForm(false); };

  const handleIconUpload = async (file: File) => {
    if (!editing) return;
    try {
      const url = await uploadImage.mutateAsync({ file, path: `tasks/icon-${Date.now()}` });
      setEditing({ ...editing, icon_url: url });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title_en.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }

    const payload: any = {
      title_en: editing.title_en, title_ar: editing.title_ar || null,
      description_en: editing.description_en || null, description_ar: editing.description_ar || null,
      type: editing.type, reward_amount: editing.reward_amount,
      reward_currency_id: editing.reward_currency_id, xp_reward: editing.xp_reward,
      is_active: editing.is_active, is_required: editing.is_required,
      sort_order: editing.sort_order,
      icon_url: editing.icon_url || null,
      metadata: editing.metadata,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from("tasks").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("tasks").insert(payload));
    }
    if (err) { toast({ title: err.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast({ title: "Task saved" });
    reset();
  };

  const del = async (id: string) => {
    if (!confirm("Delete task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast({ title: "Deleted" });
  };

  const toggleActive = async (id: string, v: boolean) => {
    await supabase.from("tasks").update({ is_active: !v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const startEdit = (t: any) => {
    setEditing({
      id: t.id, title_en: t.title_en, title_ar: t.title_ar || "",
      description_en: t.description_en || "", description_ar: t.description_ar || "",
      type: t.type, reward_amount: t.reward_amount, reward_currency_id: t.reward_currency_id,
      xp_reward: t.xp_reward, is_active: t.is_active, is_required: t.is_required,
      sort_order: t.sort_order,
      icon_url: t.icon_url || "",
      metadata: t.metadata || {},
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-3">
      {!showForm && (
        <Button onClick={() => { setEditing({ ...empty }); setShowForm(true); }} className="w-full h-9 text-xs">
          <Plus className="w-3 h-3 me-1" /> Add Task
        </Button>
      )}

      {showForm && editing && (
        <div className="glass-card rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editing.id ? "Edit Task" : "New Task"}</h3>
            <Button size="icon" variant="ghost" onClick={reset} className="h-7 w-7"><X className="w-4 h-4" /></Button>
          </div>

          {/* Task Icon */}
          <div>
            <label className="text-[10px] text-muted-foreground">Task Icon (optional — supports GIF)</label>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border border-border">
                {editing.icon_url ? (
                  <AppIcon src={editing.icon_url} fallback={Star} size={32} className="w-8 h-8 object-contain" />
                ) : (
                  <Star className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <Input
                value={editing.icon_url}
                onChange={(e) => setEditing({ ...editing, icon_url: e.target.value })}
                placeholder="Paste URL or upload ↓"
                className="h-8 text-xs flex-1"
              />
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleIconUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                disabled={uploadImage.isPending}
                onClick={() => iconInputRef.current?.click()}
              >
                {uploadImage.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground">Title (English)</label>
            <Input value={editing.title_en} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">العنوان (عربي)</label>
            <Input value={editing.title_ar} onChange={(e) => setEditing({ ...editing, title_ar: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Description (En)</label>
            <Textarea value={editing.description_en} onChange={(e) => setEditing({ ...editing, description_en: e.target.value })} rows={2} className="text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">الوصف (عربي)</label>
            <Textarea value={editing.description_ar} onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })} rows={2} className="text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Type</label>
              <Select value={editing.type} onValueChange={(v: any) => setEditing({ ...editing, type: v, metadata: {} })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram_join">Telegram Join</SelectItem>
                  <SelectItem value="social_link">Social Link / Visit</SelectItem>
                  <SelectItem value="watch_ad">Watch Ad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Currency</label>
              <Select value={editing.reward_currency_id || "none"} onValueChange={(v) => setEditing({ ...editing, reward_currency_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(currencies || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.symbol} ({c.name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Reward amount</label>
              <Input type="number" value={editing.reward_amount} onChange={(e) => setEditing({ ...editing, reward_amount: +e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">XP reward</label>
              <Input type="number" value={editing.xp_reward} onChange={(e) => setEditing({ ...editing, xp_reward: +e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Sort order</label>
              <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: +e.target.value })} className="h-8 text-xs" />
            </div>
          </div>

          {/* Telegram Join metadata */}
          {editing.type === "telegram_join" && (
            <div className="space-y-2 p-2 bg-secondary/40 rounded-lg">
              <p className="text-[10px] font-medium text-primary">Bot Verification Settings</p>
              <p className="text-[10px] text-muted-foreground">
                The bot must be an admin in the channel/group for verification to work.
              </p>
              <div>
                <label className="text-[10px] text-muted-foreground">Channel/Group ID (with @ or -100…)</label>
                <Input
                  value={editing.metadata?.channel_id || ""}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, channel_id: e.target.value } })}
                  className="h-8 text-xs"
                  placeholder="@MyChannel or -1001234567890"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Channel URL (for Join button)</label>
                <Input
                  value={editing.metadata?.channel_url || ""}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, channel_url: e.target.value } })}
                  className="h-8 text-xs"
                  placeholder="https://t.me/MyChannel"
                />
              </div>
            </div>
          )}

          {/* Social link metadata */}
          {editing.type === "social_link" && (
            <div className="space-y-2 p-2 bg-secondary/40 rounded-lg">
              <div>
                <label className="text-[10px] text-muted-foreground">Platform (twitter, instagram, tiktok, youtube, website)</label>
                <Input
                  value={editing.metadata?.platform || ""}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, platform: e.target.value } })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">URL</label>
                <Input
                  value={editing.metadata?.url || ""}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, url: e.target.value } })}
                  className="h-8 text-xs"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Min delay (seconds before verify)</label>
                <Input
                  type="number"
                  value={editing.metadata?.min_delay_seconds ?? 10}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, min_delay_seconds: +e.target.value } })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Active
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Switch checked={editing.is_required} onCheckedChange={(v) => setEditing({ ...editing, is_required: v })} /> Required (Home)
            </label>
          </div>

          <Button onClick={save} className="w-full h-8 text-xs">
            <Save className="w-3 h-3 me-1" /> Save Task
          </Button>
        </div>
      )}

      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
      ) : (
        (tasks || []).map((t: any) => (
          <div key={t.id} className="glass-card rounded-xl p-3 flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
              <AppIcon
                src={t.icon_url || null}
                fallback={Star}
                size={28}
                className="w-7 h-7 object-contain"
                playOnClick={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.title_en}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[9px]">{t.type}</Badge>
                {t.reward_amount > 0 && (
                  <span className="text-[10px] text-accent">
                    +{t.reward_amount} {t.currencies?.symbol || ""}
                  </span>
                )}
                {t.xp_reward > 0 && <span className="text-[10px] text-primary">+{t.xp_reward} XP</span>}
                {t.is_required && <Badge className="bg-primary/10 text-primary text-[9px] border-0">Req</Badge>}
              </div>
            </div>
            <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t.id, t.is_active)} />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)}>
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(t.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
