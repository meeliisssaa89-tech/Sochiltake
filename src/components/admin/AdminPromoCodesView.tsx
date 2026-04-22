import { useState } from "react";
import { usePromoCodes, useCreatePromoCode, useDeletePromoCode, useTogglePromoCode, useCurrencies, useAllUsers, useAppSettings } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { notifyNewContent } from "@/lib/notifyContent";
import { Plus, Trash2, X, Save, Tag, Copy, Send } from "lucide-react";

interface PromoForm {
  code: string;
  reward_amount: number;
  reward_currency_id: string | null;
  xp_reward: number;
  max_uses: number;
  is_active: boolean;
  expires_at: string;
  notify_telegram: boolean;
  featured_user_id: string | null;
}

const empty: PromoForm = {
  code: "", reward_amount: 100, reward_currency_id: null,
  xp_reward: 0, max_uses: 0, is_active: true, expires_at: "",
  notify_telegram: true, featured_user_id: null,
};

export function AdminPromoCodesView() {
  const { data: codes, isLoading } = usePromoCodes();
  const { data: currencies } = useCurrencies();
  const { data: allUsers } = useAllUsers();
  const { data: settings } = useAppSettings();
  const createCode = useCreatePromoCode();
  const deleteCode = useDeletePromoCode();
  const toggleCode = useTogglePromoCode();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PromoForm>({ ...empty });

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm({ ...form, code });
  };

  const save = async () => {
    if (!form.code.trim()) { toast({ title: "Code required", variant: "destructive" }); return; }
    try {
      const code = form.code.toUpperCase().trim();
      await createCode.mutateAsync({
        code,
        reward_amount: form.reward_amount,
        reward_currency_id: form.reward_currency_id,
        xp_reward: form.xp_reward,
        max_uses: form.max_uses,
        is_active: form.is_active,
        expires_at: form.expires_at || null,
      });
      toast({ title: "Promo code created" });

      if (form.notify_telegram) {
        try {
          const cur = (currencies || []).find((c: any) => c.id === form.reward_currency_id);
          const featured = form.featured_user_id
            ? (allUsers || []).find((u: any) => u.telegram_id === form.featured_user_id)
            : null;
          const webAppUrl = (settings as any)?.bot_webapp_url || window.location.origin;
          const r = await notifyNewContent("promo", {
            title: `Promo Code: ${code}`,
            rewardAmount: form.reward_amount,
            rewardSymbol: cur?.symbol,
            rewardIconUrl: cur?.icon_url,
            xpReward: form.xp_reward,
            promoCode: code,
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

      setForm({ ...empty });
      setShowForm(false);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!" });
  };

  return (
    <div className="space-y-3">
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full h-9 text-xs">
          <Plus className="w-3 h-3 me-1" /> Create Promo Code
        </Button>
      )}

      {showForm && (
        <div className="glass-card rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> New Promo Code</h3>
            <Button size="icon" variant="ghost" onClick={() => setShowForm(false)} className="h-7 w-7"><X className="w-4 h-4" /></Button>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Code</label>
            <div className="flex gap-2">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="h-8 text-xs font-mono flex-1"
                placeholder="SUMMER2024"
              />
              <Button size="sm" variant="outline" onClick={generateCode} className="h-8 text-xs">Auto</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Currency</label>
              <Select value={form.reward_currency_id || "none"} onValueChange={(v) => setForm({ ...form, reward_currency_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(currencies || []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Reward amount</label>
              <Input type="number" value={form.reward_amount} onChange={(e) => setForm({ ...form, reward_amount: +e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">XP reward</label>
              <Input type="number" value={form.xp_reward} onChange={(e) => setForm({ ...form, xp_reward: +e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Max uses (0 = unlimited)</label>
              <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: +e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">Expires at (optional)</label>
              <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-xs">Active</span>
          </div>

          <div className="border-t border-border/40 pt-2 mt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium flex-1">Notify Telegram users</span>
              <Switch checked={form.notify_telegram} onCheckedChange={(v) => setForm({ ...form, notify_telegram: v })} />
            </div>
            {form.notify_telegram && (
              <div>
                <label className="text-[10px] text-muted-foreground">Featured user (optional — name + photo in message)</label>
                <Select
                  value={form.featured_user_id || "none"}
                  onValueChange={(v) => setForm({ ...form, featured_user_id: v === "none" ? null : v })}
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

          <Button onClick={save} disabled={createCode.isPending} className="w-full h-8 text-xs">
            <Save className="w-3 h-3 me-1" /> Create Code
          </Button>
        </div>
      )}

      {isLoading ? (
        [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)
      ) : (
        (codes || []).map((c: any) => {
          const expired = c.expires_at && new Date(c.expires_at) < new Date();
          const full = c.max_uses > 0 && c.used_count >= c.max_uses;
          return (
            <div key={c.id} className="glass-card rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-bold">{c.code}</span>
                    {!c.is_active && <Badge variant="outline" className="text-[9px]">Inactive</Badge>}
                    {expired && <Badge className="bg-destructive/10 text-destructive border-0 text-[9px]">Expired</Badge>}
                    {full && <Badge className="bg-destructive/10 text-destructive border-0 text-[9px]">Full</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    +{c.reward_amount} {c.currencies?.symbol || ""} • +{c.xp_reward} XP • Used: {c.used_count}/{c.max_uses || "∞"}
                    {c.expires_at && ` • Exp: ${new Date(c.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Switch checked={c.is_active} onCheckedChange={() => toggleCode.mutateAsync({ id: c.id, is_active: !c.is_active })} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(c.code)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCode.mutateAsync(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })
      )}

      {!isLoading && (codes || []).length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No promo codes yet.</p>
      )}
    </div>
  );
}
