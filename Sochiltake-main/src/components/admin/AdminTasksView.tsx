import { useState, useRef } from "react";
import { useAllTasks, useCurrencies, useUploadImage, useAllUsers, useAppSettings } from "@/hooks/useSupabaseData";
import { notifyNewContent } from "@/lib/notifyContent";
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
import { Plus, Trash2, Save, Edit2, X, Upload, Loader2, Star, FileText, Search, Link2, ExternalLink } from "lucide-react";
import { adminAction } from "@/lib/adminAuth";
import { useQuery } from "@tanstack/react-query";

interface TaskForm {
  id?: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  type: "telegram_join" | "watch_ad" | "social_link" | "code_api" | "submission";
  reward_amount: number;
  reward_currency_id: string | null;
  extra_rewards: Array<{ currency_id: string; amount: number }>;
  xp_reward: number;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  icon_url: string;
  metadata: Record<string, any>;
  notify_telegram: boolean;
  featured_user_id: string | null;
  // code_api fields
  verify_url: string;
  verify_method: "POST" | "GET";
  verify_headers: string; // JSON text
  body_template: string;  // JSON text
  success_key: string;
  success_value: string;
  max_completions: number | null;
  user_limit: number;
  publisher_article_id: string | null;
}

const empty: TaskForm = {
  title_en: "", title_ar: "", description_en: "", description_ar: "",
  type: "telegram_join", reward_amount: 100, reward_currency_id: null,
  extra_rewards: [],
  xp_reward: 10, is_active: true, is_required: false, sort_order: 0,
  icon_url: "", metadata: {},
  notify_telegram: true, featured_user_id: null,
  verify_url: "", verify_method: "POST",
  verify_headers: "{}",
  body_template: '{\n  "token": "{{token}}",\n  "code": "{{code}}"\n}',
  success_key: "success", success_value: "true",
  max_completions: null, user_limit: 1,
  publisher_article_id: null,
};

export function AdminTasksView() {
  const { data: tasks, isLoading } = useAllTasks();
  const { data: currencies } = useCurrencies();
  const { data: allUsers } = useAllUsers();
  const { data: settings } = useAppSettings();
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
      reward_currency_id: editing.reward_currency_id,
      extra_rewards: (editing.extra_rewards || []).filter(
        (r) => r.currency_id && Number(r.amount) > 0
      ),
      xp_reward: editing.xp_reward,
      is_active: editing.is_active, is_required: editing.is_required,
      sort_order: editing.sort_order,
      icon_url: editing.icon_url || null,
      metadata: editing.metadata,
    };

    if (editing.type === "code_api") {
      let parsedHeaders: any = {};
      let parsedBody: any = {};
      try { parsedHeaders = editing.verify_headers.trim() ? JSON.parse(editing.verify_headers) : {}; }
      catch { toast({ title: "Invalid JSON in headers", variant: "destructive" }); return; }
      try { parsedBody = editing.body_template.trim() ? JSON.parse(editing.body_template) : {}; }
      catch { toast({ title: "Invalid JSON in body template", variant: "destructive" }); return; }
      if (!editing.verify_url.trim()) {
        toast({ title: "Verify URL is required", variant: "destructive" }); return;
      }
      payload.verify_url = editing.verify_url.trim();
      payload.verify_method = editing.verify_method;
      payload.verify_headers = parsedHeaders;
      payload.body_template = parsedBody;
      payload.success_key = editing.success_key.trim() || "success";
      payload.success_value = editing.success_value.trim() || "true";
      payload.max_completions = editing.max_completions || null;
      payload.user_limit = editing.user_limit ?? 1;
      payload.publisher_article_id = editing.publisher_article_id || null;
    } else {
      payload.verify_url = null;
      payload.verify_method = null;
      payload.verify_headers = {};
      payload.body_template = {};
      payload.publisher_article_id = null;
    }
    let err;
    const isNew = !editing.id;
    if (editing.id) {
      ({ error: err } = await supabase.from("tasks").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("tasks").insert(payload));
    }
    if (err) { toast({ title: err.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["all-tasks"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    toast({ title: "Task saved" });

    if (isNew && editing.notify_telegram && editing.is_active) {
      try {
        const cur = (currencies || []).find((c: any) => c.id === editing.reward_currency_id);
        const featured = editing.featured_user_id
          ? (allUsers || []).find((u: any) => u.telegram_id === editing.featured_user_id)
          : null;
        const webAppUrl = (settings as any)?.bot_webapp_url || window.location.origin;
        const r = await notifyNewContent("task", {
          title: editing.title_ar || editing.title_en,
          description: editing.description_ar || editing.description_en || undefined,
          rewardAmount: editing.reward_amount,
          rewardSymbol: cur?.symbol,
          rewardIconUrl: cur?.icon_url || editing.icon_url || null,
          xpReward: editing.xp_reward,
          featuredUser: featured
            ? {
                name: featured.first_name || featured.username || "User",
                photoUrl: featured.photo_url,
              }
            : null,
          webAppUrl,
        });
        toast({ title: `📣 Sent to ${r.sent} users` });
      } catch (e: any) {
        toast({ title: "Notification failed", description: e.message, variant: "destructive" });
      }
    }

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
      extra_rewards: Array.isArray(t.extra_rewards)
        ? t.extra_rewards.map((r: any) => ({ currency_id: r.currency_id, amount: Number(r.amount) || 0 }))
        : [],
      xp_reward: t.xp_reward, is_active: t.is_active, is_required: t.is_required,
      sort_order: t.sort_order,
      icon_url: t.icon_url || "",
      metadata: t.metadata || {},
      verify_url: t.verify_url || "",
      verify_method: (t.verify_method || "POST") as "POST" | "GET",
      verify_headers: JSON.stringify(t.verify_headers || {}, null, 2),
      body_template: JSON.stringify(t.body_template || { token: "{{token}}", code: "{{code}}" }, null, 2),
      success_key: t.success_key || "success",
      success_value: t.success_value ?? "true",
      max_completions: t.max_completions ?? null,
      user_limit: t.user_limit ?? 1,
      publisher_article_id: t.publisher_article_id || null,
      notify_telegram: t.notify_telegram ?? true,
      featured_user_id: t.featured_user_id ?? null,
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
                  <SelectItem value="code_api">Code Verification (External API)</SelectItem>
                  <SelectItem value="submission">Submission (Manual Review)</SelectItem>
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

          {/* Extra rewards (multi-currency) */}
          <div className="space-y-2 p-2 bg-secondary/40 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-primary">مكافآت إضافية (عملات أخرى)</p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  const firstCur = (currencies || []).find(
                    (c: any) => c.id !== editing.reward_currency_id
                  );
                  setEditing({
                    ...editing,
                    extra_rewards: [
                      ...editing.extra_rewards,
                      { currency_id: firstCur?.id || "", amount: 0 },
                    ],
                  });
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                إضافة
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              تستطيع منح المستخدم أكثر من عملة عند إكمال نفس المهمة. تُضاف لكل العملات معاً.
            </p>
            {editing.extra_rewards.length === 0 && (
              <p className="text-[10px] text-muted-foreground/70 italic">لا توجد مكافآت إضافية بعد.</p>
            )}
            {editing.extra_rewards.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={r.currency_id || "none"}
                  onValueChange={(v) => {
                    const next = [...editing.extra_rewards];
                    next[idx] = { ...next[idx], currency_id: v === "none" ? "" : v };
                    setEditing({ ...editing, extra_rewards: next });
                  }}
                >
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {(currencies || []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.symbol} ({c.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={r.amount}
                  onChange={(e) => {
                    const next = [...editing.extra_rewards];
                    next[idx] = { ...next[idx], amount: +e.target.value };
                    setEditing({ ...editing, extra_rewards: next });
                  }}
                  className="h-7 text-xs w-24"
                  placeholder="Amount"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive shrink-0"
                  onClick={() =>
                    setEditing({
                      ...editing,
                      extra_rewards: editing.extra_rewards.filter((_, i) => i !== idx),
                    })
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
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

          {/* Submission metadata */}
          {editing.type === "submission" && (
            <div className="space-y-2 p-2 bg-secondary/40 rounded-lg">
              <p className="text-[10px] font-medium text-primary">Submission Task Settings</p>
              <p className="text-[10px] text-muted-foreground">
                User fills a form (photo, text, email, or ID document). Admin reviews submissions manually in the Submissions tab.
                Reward is credited after admin approval.
              </p>
              <div>
                <label className="text-[10px] text-muted-foreground">Submission Type</label>
                <Select
                  value={editing.metadata?.submission_type || "text"}
                  onValueChange={(v) => setEditing({ ...editing, metadata: { ...editing.metadata, submission_type: v } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text (written response)</SelectItem>
                    <SelectItem value="email">Email address</SelectItem>
                    <SelectItem value="photo">Photo (image upload)</SelectItem>
                    <SelectItem value="id_document">ID Document (image upload)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Submission instructions (shown to user)</label>
                <Input
                  value={editing.metadata?.submission_label || ""}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, submission_label: e.target.value } })}
                  className="h-8 text-xs"
                  placeholder="e.g. Upload a screenshot of your completed action"
                />
              </div>
            </div>
          )}

          {/* Code API metadata */}
          {editing.type === "code_api" && (
            <div className="space-y-2 p-2 bg-secondary/40 rounded-lg">
              <p className="text-[10px] font-medium text-primary">External Code Verification</p>
              <p className="text-[10px] text-muted-foreground">
                User visits the redirect URL, gets a one-time code, then submits it.
                Placeholders replaced: <code>{`{{user_id}}`}</code>, <code>{`{{code}}`}</code>, and <code>{`{{token}}`}</code>{" "}
                — a fresh secure session token is generated on every "Start" so each visit gets its own one-time code.
              </p>

              <PublisherArticlePicker
                value={editing.publisher_article_id}
                onPick={(article, siteUrl) => {
                  if (!article) {
                    setEditing({ ...editing, publisher_article_id: null });
                    return;
                  }
                  const base = (siteUrl || "").replace(/\/$/, "");
                  setEditing({
                    ...editing,
                    publisher_article_id: article.id,
                    metadata: {
                      ...editing.metadata,
                      redirect_url: `${base}/p/${article.slug}?u={{user_id}}&t={{token}}`,
                      publisher_article_slug: article.slug,
                      publisher_article_title: article.title,
                    },
                    verify_url: `${base}/api/p/verify`,
                    verify_method: "POST",
                    verify_headers: "{}",
                    body_template: JSON.stringify({
                      user_id: "{{user_id}}",
                      code: "{{code}}",
                      token: "{{token}}",
                      slug: article.slug,
                    }, null, 2),
                    success_key: "success",
                    success_value: "true",
                  });
                  toast({ title: "Article linked", description: "Verification fields auto-filled." });
                }}
              />

              <div>
                <label className="text-[10px] text-muted-foreground">Redirect URL (where user goes to get the code)</label>
                <Input
                  value={editing.metadata?.redirect_url || ""}
                  onChange={(e) => setEditing({ ...editing, metadata: { ...editing.metadata, redirect_url: e.target.value } })}
                  className="h-8 text-xs"
                  placeholder="https://partner.example.com/start?token={{token}}"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">Verify URL (your API)</label>
                  <Input
                    value={editing.verify_url}
                    onChange={(e) => setEditing({ ...editing, verify_url: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="https://partner.example.com/api/verify"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Method</label>
                  <Select value={editing.verify_method} onValueChange={(v: any) => setEditing({ ...editing, verify_method: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Headers (JSON)</label>
                <Textarea
                  value={editing.verify_headers}
                  onChange={(e) => setEditing({ ...editing, verify_headers: e.target.value })}
                  rows={2}
                  className="text-xs font-mono"
                  placeholder='{"Authorization":"Bearer XYZ"}'
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Body template (JSON)</label>
                <Textarea
                  value={editing.body_template}
                  onChange={(e) => setEditing({ ...editing, body_template: e.target.value })}
                  rows={4}
                  className="text-xs font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Success key (e.g. "success" or "data.ok")</label>
                  <Input
                    value={editing.success_key}
                    onChange={(e) => setEditing({ ...editing, success_key: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Success value (string match)</label>
                  <Input
                    value={editing.success_value}
                    onChange={(e) => setEditing({ ...editing, success_value: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Max total completions (blank = ∞)</label>
                  <Input
                    type="number"
                    value={editing.max_completions ?? ""}
                    onChange={(e) => setEditing({ ...editing, max_completions: e.target.value === "" ? null : +e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Per-user limit</label>
                  <Input
                    type="number"
                    value={editing.user_limit}
                    onChange={(e) => setEditing({ ...editing, user_limit: +e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
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

          {!editing.id && (
            <div className="border-t border-border/40 pt-2 mt-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium flex-1">📣 Notify Telegram users</span>
                <Switch
                  checked={editing.notify_telegram}
                  onCheckedChange={(v) => setEditing({ ...editing, notify_telegram: v })}
                />
              </div>
              {editing.notify_telegram && (
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    Featured user (optional — name + photo in message)
                  </label>
                  <Select
                    value={editing.featured_user_id || "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, featured_user_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {(allUsers || []).slice(0, 100).map((u: any) => (
                        <SelectItem key={u.telegram_id} value={u.telegram_id}>
                          {u.first_name || u.username || u.telegram_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

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
                {Array.isArray(t.extra_rewards) &&
                  t.extra_rewards.map((r: any, idx: number) => {
                    const cur = (currencies || []).find((c: any) => c.id === r.currency_id);
                    if (!cur || !r.amount) return null;
                    return (
                      <span key={idx} className="text-[10px] text-accent">
                        +{r.amount} {cur.symbol}
                      </span>
                    );
                  })}
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

// ─── Publisher article picker (used inside code-task editor) ──────────
interface PubArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  visit_count?: number;
  earnings?: number;
  cover_url?: string | null;
  shortlink_publishers?: { email?: string; display_name?: string };
}

function PublisherArticlePicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (article: PubArticle | null, siteUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-published-articles"],
    queryFn: async () =>
      adminAction<{ articles: PubArticle[]; site_url: string }>(
        "shortlink_list_published_articles",
        { limit: 100 }
      ),
    enabled: open || !!value,
  });

  const articles = data?.articles || [];
  const siteUrl = data?.site_url || "";
  const linked = value ? articles.find((a) => a.id === value) : null;

  const filtered = q.trim()
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q.toLowerCase()) ||
          a.slug.toLowerCase().includes(q.toLowerCase())
      )
    : articles;

  return (
    <div className="space-y-1.5 p-2 rounded-lg border border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-[11px] font-semibold text-primary truncate">
            {linked
              ? `Linked to: ${linked.title}`
              : "Link this task to a publisher article (optional)"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {linked && siteUrl && (
            <a
              href={`${siteUrl}/p/${linked.slug}`}
              target="_blank"
              rel="noreferrer"
              className="h-6 w-6 inline-flex items-center justify-center hover:bg-secondary rounded"
              title="Open article"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {linked && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-destructive"
              onClick={() => onPick(null, siteUrl)}
              data-testid="button-unlink-article"
            >
              <X className="w-3 h-3 me-1" /> Unlink
            </Button>
          )}
          <Button
            size="sm"
            variant={linked ? "outline" : "default"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setOpen((v) => !v)}
            data-testid="button-toggle-article-picker"
          >
            <Link2 className="w-3 h-3 me-1" />
            {linked ? "Change" : "Pick article"}
          </Button>
        </div>
      </div>

      {linked && siteUrl && (
        <p className="text-[10px] text-muted-foreground font-mono truncate">
          {siteUrl}/p/{linked.slug}
        </p>
      )}

      {open && (
        <div className="space-y-1.5 pt-1.5 border-t border-primary/10">
          <div className="relative">
            <Search className="w-3 h-3 absolute start-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search articles…"
              className="h-7 text-[11px] ps-7"
              data-testid="input-search-articles"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {isLoading && (
              <p className="text-[10px] text-muted-foreground text-center py-3">
                <Loader2 className="w-3 h-3 inline animate-spin me-1" />
                Loading…
              </p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">
                No approved articles found.
              </p>
            )}
            {filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  onPick(a, siteUrl);
                  setOpen(false);
                  setQ("");
                }}
                className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-secondary text-start"
                data-testid={`button-pick-article-${a.id}`}
              >
                {a.cover_url ? (
                  <img
                    src={a.cover_url}
                    alt=""
                    className="w-8 h-8 object-cover rounded shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{a.title}</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    /p/{a.slug} · {a.shortlink_publishers?.email}
                  </p>
                </div>
                {value === a.id && (
                  <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
