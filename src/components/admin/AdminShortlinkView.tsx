import { useEffect, useState } from "react";
import { adminAction } from "@/lib/adminAuth";
import { useCurrencies } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save, Settings, FileText, Users, DollarSign, BarChart3, MonitorPlay,
  CheckCircle2, XCircle, Trash2, Lock, Unlock, ExternalLink, Copy, Loader2,
} from "lucide-react";

type SubTab = "settings" | "ads" | "publishers" | "articles" | "payouts" | "stats";

export function AdminShortlinkView() {
  const [tab, setTab] = useState<SubTab>("settings");

  const tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: "settings", label: "Settings", icon: Settings },
    { id: "ads", label: "Ad Slots", icon: MonitorPlay },
    { id: "publishers", label: "Publishers", icon: Users },
    { id: "articles", label: "Articles", icon: FileText },
    { id: "payouts", label: "Payouts", icon: DollarSign },
    { id: "stats", label: "Stats", icon: BarChart3 },
  ];

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-2">
        <div className="flex items-center gap-2 mb-2 px-1 pt-1">
          <ExternalLink className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-sm font-bold">Shortlink Site Control</h3>
        </div>
        <p className="text-[10px] text-muted-foreground px-1 pb-2">
          Fully separated from the main app. Toggle features below to roll them out.
        </p>
        <div className="flex flex-wrap gap-1">
          {tabs.map((s) => (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                tab === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
              data-testid={`tab-shortlink-${s.id}`}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "settings" && <SettingsView />}
      {tab === "ads" && <AdsView />}
      {tab === "publishers" && <PublishersView />}
      {tab === "articles" && <ArticlesView />}
      {tab === "payouts" && <PayoutsView />}
      {tab === "stats" && <StatsView />}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────
function SettingsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: currencies = [] } = useCurrencies();
  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-settings"],
    queryFn: async () => adminAction<{ settings: any }>("shortlink_get_settings"),
  });
  const settings = data?.settings || {};
  const [s, setS] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) setS({ ...settings });
  }, [settings]);

  const update = (k: string, v: any) => setS((prev: any) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await adminAction("shortlink_save_settings", { ...s });
      qc.invalidateQueries({ queryKey: ["shortlink-settings"] });
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-3">
      {/* Feature flags */}
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h4 className="text-xs font-bold text-primary">Feature Flags</h4>
        <FlagRow label="Publishers program enabled" hint="Allow users to register on the shortlink site & link in Telegram"
          checked={!!s.publishers_enabled} onChange={(v) => update("publishers_enabled", v)} testId="switch-pub-enabled" />
        <FlagRow label="Public sign-up enabled" hint="Allow new author accounts to be created"
          checked={!!s.signup_enabled} onChange={(v) => update("signup_enabled", v)} testId="switch-signup-enabled" />
        <FlagRow label="Articles require approval" hint="When ON, new articles stay 'pending' until you approve them"
          checked={!!s.articles_require_approval} onChange={(v) => update("articles_require_approval", v)} testId="switch-approval" />
        <FlagRow label="Payouts enabled" hint="Allow publishers to convert pending balance into Telegram balance"
          checked={!!s.payouts_enabled} onChange={(v) => update("payouts_enabled", v)} testId="switch-payouts" />
      </div>

      {/* Earnings config */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h4 className="text-xs font-bold text-primary">Earnings & Payout Rules</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Revenue per visit">
            <Input type="number" step="0.0001" value={s.revenue_per_visit ?? 0}
              onChange={(e) => update("revenue_per_visit", Number(e.target.value))}
              className="h-8 text-xs" data-testid="input-revenue-per-visit" />
          </Field>
          <Field label="Minimum payout">
            <Input type="number" step="0.01" value={s.min_payout ?? 0}
              onChange={(e) => update("min_payout", Number(e.target.value))}
              className="h-8 text-xs" data-testid="input-min-payout" />
          </Field>
          <Field label="Sign-up bonus (publisher)">
            <Input type="number" step="0.01" value={s.signup_bonus ?? 0}
              onChange={(e) => update("signup_bonus", Number(e.target.value))}
              className="h-8 text-xs" data-testid="input-signup-bonus" />
          </Field>
          <Field label="Payout currency">
            <Select value={s.payout_currency_id || "none"}
              onValueChange={(v) => update("payout_currency_id", v === "none" ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {(currencies as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.symbol} — {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {/* Reader site config */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h4 className="text-xs font-bold text-primary">Reader Site (code_api task)</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Page count">
            <Input type="number" value={s.page_count ?? 5} onChange={(e) => update("page_count", +e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Wait per page (sec)">
            <Input type="number" value={s.wait_seconds ?? 8} onChange={(e) => update("wait_seconds", +e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Site title">
            <Input value={s.site_title || ""} onChange={(e) => update("site_title", e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Brand color">
            <Input value={s.brand_color || ""} onChange={(e) => update("brand_color", e.target.value)} className="h-8 text-xs" placeholder="#7c3aed" />
          </Field>
          <Field label="Site URL (https://…)" full>
            <Input value={s.site_url || ""} onChange={(e) => update("site_url", e.target.value)} className="h-8 text-xs" placeholder="https://yoursite.com" />
          </Field>
        </div>
      </div>

      {/* AI generation */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h4 className="text-xs font-bold text-primary">AI Article Generation</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Provider">
            <Input value={s.ai_provider || "openai"} onChange={(e) => update("ai_provider", e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Language">
            <Input value={s.ai_language || "en"} onChange={(e) => update("ai_language", e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Text model">
            <Input value={s.ai_model || ""} onChange={(e) => update("ai_model", e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Image model">
            <Input value={s.ai_image_model || ""} onChange={(e) => update("ai_image_model", e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="API key (kept on server)" full>
            <Input type="password" value={s.ai_api_key || ""} onChange={(e) => update("ai_api_key", e.target.value)} className="h-8 text-xs" />
          </Field>
          <Field label="Topics (comma-separated)" full>
            <Input value={Array.isArray(s.ai_topics) ? s.ai_topics.join(",") : ""}
              onChange={(e) => update("ai_topics", e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean))}
              className="h-8 text-xs" />
          </Field>
        </div>
      </div>

      <Button className="w-full h-9 text-xs" onClick={save} disabled={saving} data-testid="button-save-shortlink">
        {saving ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
        Save All Settings
      </Button>
    </div>
  );
}

// ─── Ad Slots ─────────────────────────────────────────────────────────
function AdsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-settings"],
    queryFn: async () => adminAction<{ settings: any }>("shortlink_get_settings"),
  });
  const settings = data?.settings || {};
  const [s, setS] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setS({ ...settings }); }, [settings]);

  const slots: { key: string; label: string }[] = [
    { key: "ad_head_html", label: "Head (script tags)" },
    { key: "ad_top_html", label: "Top of page" },
    { key: "ad_middle_html", label: "Middle of article" },
    { key: "ad_bottom_html", label: "Bottom of page" },
    { key: "ad_interstitial_html", label: "Interstitial (between pages)" },
  ];

  const save = async () => {
    setSaving(true);
    try {
      const out: any = {};
      for (const sl of slots) out[sl.key] = s[sl.key] || "";
      await adminAction("shortlink_save_settings", out);
      qc.invalidateQueries({ queryKey: ["shortlink-settings"] });
      toast({ title: "Ad slots saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-3">
      {slots.map((sl) => (
        <div key={sl.key} className="glass-card rounded-xl p-3 space-y-1">
          <label className="text-[10px] text-muted-foreground">{sl.label}</label>
          <Textarea value={s[sl.key] || ""} onChange={(e) => setS({ ...s, [sl.key]: e.target.value })}
            rows={4} className="text-[10px] font-mono" placeholder="<script>...</script>" />
        </div>
      ))}
      <Button className="w-full h-9 text-xs" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
        Save Ad Slots
      </Button>
    </div>
  );
}

// ─── Publishers ───────────────────────────────────────────────────────
function PublishersView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-publishers"],
    queryFn: async () => adminAction<{ publishers: any[] }>("shortlink_list_publishers"),
  });

  const block = async (id: string, blocked: boolean) => {
    try {
      await adminAction("shortlink_set_publisher_blocked", { id, blocked });
      qc.invalidateQueries({ queryKey: ["shortlink-publishers"] });
      toast({ title: blocked ? "Blocked" : "Unblocked" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  const unlink = async (id: string) => {
    if (!confirm("Unlink this publisher from their Telegram account?")) return;
    try {
      await adminAction("shortlink_unlink_publisher", { id });
      qc.invalidateQueries({ queryKey: ["shortlink-publishers"] });
      toast({ title: "Unlinked" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this publisher and ALL their articles? Cannot be undone.")) return;
    try {
      await adminAction("shortlink_delete_publisher", { id });
      qc.invalidateQueries({ queryKey: ["shortlink-publishers"] });
      toast({ title: "Deleted" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;
  const list = data?.publishers || [];

  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No publishers yet.</p>
      )}
      {list.map((p: any) => (
        <div key={p.id} className="glass-card rounded-xl p-3" data-testid={`publisher-${p.id}`}>
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{p.email}</p>
              <p className="text-[10px] text-muted-foreground">
                Code: <span className="font-mono">{p.link_code}</span> • Visits: {p.total_visits || 0}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Pending: {Number(p.pending_balance || 0).toFixed(4)} • Lifetime: {Number(p.lifetime_earnings || 0).toFixed(4)}
              </p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {p.is_blocked && <Badge variant="destructive" className="text-[9px]">Blocked</Badge>}
                {p.linked_telegram_id ? (
                  <Badge className="bg-success/10 text-success text-[9px] border-0">
                    Linked: {p.linked_telegram_id}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px]">Unlinked</Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                onClick={() => block(p.id, !p.is_blocked)}
                data-testid={`button-block-${p.id}`}>
                {p.is_blocked ? <><Unlock className="w-3 h-3 me-1" />Unblock</> : <><Lock className="w-3 h-3 me-1" />Block</>}
              </Button>
              {p.linked_telegram_id && (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => unlink(p.id)}>
                  Unlink
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-destructive" onClick={() => remove(p.id)}>
                <Trash2 className="w-3 h-3 me-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Articles ─────────────────────────────────────────────────────────
function ArticlesView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-pub-articles", filter],
    queryFn: async () => adminAction<{ articles: any[] }>("shortlink_list_articles", { status: filter }),
  });

  const setStatus = async (id: string, status: string, reason?: string) => {
    try {
      await adminAction("shortlink_set_article_status", { id, status, reason });
      qc.invalidateQueries({ queryKey: ["shortlink-pub-articles"] });
      toast({ title: `Marked ${status}` });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete article?")) return;
    try {
      await adminAction("shortlink_delete_article", { id });
      qc.invalidateQueries({ queryKey: ["shortlink-pub-articles"] });
      toast({ title: "Deleted" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  const list = data?.articles || [];

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-2 flex gap-1 flex-wrap">
        {["", "pending", "approved", "rejected"].map((f) => (
          <button key={f || "all"} onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded-md text-[10px] ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f || "All"}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-24 rounded-xl" />}
      {!isLoading && list.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No articles.</p>
      )}

      {list.map((a: any) => (
        <div key={a.id} className="glass-card rounded-xl p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate">{a.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                by {a.shortlink_publishers?.email} • {new Date(a.created_at).toLocaleDateString()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Slug: <span className="font-mono">/p/{a.slug}</span> • Visits: {a.visit_count} • Earnings: {Number(a.earnings || 0).toFixed(4)}
              </p>
            </div>
            <Badge className={`text-[9px] ${
              a.status === "approved" ? "bg-success/10 text-success" :
              a.status === "rejected" ? "bg-destructive/10 text-destructive" :
              "bg-yellow-500/10 text-yellow-500"
            }`}>{a.status}</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-3">{a.content?.slice(0, 240)}…</p>
          <div className="flex gap-1 flex-wrap">
            {a.status !== "approved" && (
              <Button size="sm" className="h-6 text-[10px] px-2 bg-success hover:bg-success/80" onClick={() => setStatus(a.id, "approved")}>
                <CheckCircle2 className="w-3 h-3 me-1" /> Approve
              </Button>
            )}
            {a.status !== "rejected" && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => {
                const r = prompt("Rejection reason (optional):") || "";
                setStatus(a.id, "rejected", r);
              }}>
                <XCircle className="w-3 h-3 me-1" /> Reject
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-destructive" onClick={() => remove(a.id)}>
              <Trash2 className="w-3 h-3 me-1" /> Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Payouts ──────────────────────────────────────────────────────────
function PayoutsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-payouts", filter],
    queryFn: async () => adminAction<{ payouts: any[] }>("shortlink_list_payouts", { status: filter }),
  });

  const approve = async (id: string) => {
    if (!confirm("Approve and credit the user's Telegram balance?")) return;
    try {
      await adminAction("shortlink_approve_payout", { id });
      qc.invalidateQueries({ queryKey: ["shortlink-payouts"] });
      toast({ title: "Approved & credited" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };
  const reject = async (id: string) => {
    const note = prompt("Reason (optional):") || "";
    try {
      await adminAction("shortlink_reject_payout", { id, note });
      qc.invalidateQueries({ queryKey: ["shortlink-payouts"] });
      toast({ title: "Rejected & refunded" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
  };

  const list = data?.payouts || [];

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-2 flex gap-1 flex-wrap">
        {["pending", "approved", "rejected", ""].map((f) => (
          <button key={f || "all"} onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded-md text-[10px] ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f || "All"}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-24 rounded-xl" />}
      {!isLoading && list.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No payouts.</p>
      )}

      {list.map((p: any) => (
        <div key={p.id} className="glass-card rounded-xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">
                {Number(p.amount).toFixed(4)} {p.currencies?.symbol || ""}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {p.shortlink_publishers?.email} → tg:{p.telegram_id}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Requested: {new Date(p.requested_at).toLocaleString()}
              </p>
              {p.admin_note && <p className="text-[10px] text-yellow-600 mt-1">Note: {p.admin_note}</p>}
            </div>
            <Badge className={`text-[9px] ${
              p.status === "approved" ? "bg-success/10 text-success" :
              p.status === "rejected" ? "bg-destructive/10 text-destructive" :
              "bg-yellow-500/10 text-yellow-500"
            }`}>{p.status}</Badge>
          </div>
          {p.status === "pending" && (
            <div className="flex gap-1 mt-2">
              <Button size="sm" className="h-7 text-[10px] flex-1 bg-success hover:bg-success/80"
                onClick={() => approve(p.id)} data-testid={`button-approve-${p.id}`}>
                <CheckCircle2 className="w-3 h-3 me-1" /> Approve & Credit
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1"
                onClick={() => reject(p.id)} data-testid={`button-reject-${p.id}`}>
                <XCircle className="w-3 h-3 me-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────
function StatsView() {
  const { data, isLoading } = useQuery({
    queryKey: ["shortlink-stats"],
    queryFn: async () => adminAction<{ stats: any }>("shortlink_stats"),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  const st = data?.stats || {};

  const cards = [
    { label: "Publishers", value: st.publishers_total, sub: `${st.publishers_linked} linked` },
    { label: "Articles", value: st.articles_total, sub: `${st.articles_pending} pending` },
    { label: "Total Visits", value: st.visits_total, sub: "all-time" },
    { label: "Payouts pending", value: st.payouts_pending, sub: "review" },
    { label: "Total Paid", value: Number(st.payouts_paid_total || 0).toFixed(4), sub: "lifetime" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <div key={c.label} className="glass-card rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground">{c.label}</p>
          <p className="text-lg font-bold tabular-nums">{c.value ?? 0}</p>
          <p className="text-[9px] text-muted-foreground">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────
function FlagRow({ label, hint, checked, onChange, testId }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-[10px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
