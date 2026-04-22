import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrencies, useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Sparkles } from "lucide-react";

export function AdminSpinView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: currencies } = useCurrencies();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [config, setConfig] = useState({ enabled: true, free_spins_per_day: 3, cost_per_spin: 0 });
  useEffect(() => { if (settings?.spin_config) setConfig({ ...config, ...settings.spin_config }); /* eslint-disable-next-line */ }, [settings]);

  const { data: prizes } = useQuery({
    queryKey: ["spin-prizes-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("spin_prizes").select("*, currencies(symbol)").order("sort_order");
      return data || [];
    },
  });

  const [newPrize, setNewPrize] = useState({ label: "", image_url: "", amount: 10, currency_id: "", weight: 10, xp_reward: 0 });

  const addPrize = async () => {
    if (!newPrize.label) return;
    await supabase.from("spin_prizes").insert({
      label: newPrize.label, image_url: newPrize.image_url || null,
      amount: newPrize.amount, currency_id: newPrize.currency_id || null,
      weight: newPrize.weight, xp_reward: newPrize.xp_reward, is_active: true, sort_order: (prizes?.length || 0),
    });
    qc.invalidateQueries({ queryKey: ["spin-prizes-admin"] });
    qc.invalidateQueries({ queryKey: ["spin-prizes"] });
    setNewPrize({ label: "", image_url: "", amount: 10, currency_id: "", weight: 10, xp_reward: 0 });
    toast({ title: "Prize added" });
  };

  const delPrize = async (id: string) => {
    await supabase.from("spin_prizes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["spin-prizes-admin"] });
    qc.invalidateQueries({ queryKey: ["spin-prizes"] });
  };

  const toggle = async (id: string, v: boolean) => {
    await supabase.from("spin_prizes").update({ is_active: !v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["spin-prizes-admin"] });
    qc.invalidateQueries({ queryKey: ["spin-prizes"] });
  };

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Spin Config</h3>
        <label className="flex items-center justify-between text-xs">
          Enabled
          <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
        </label>
        <div>
          <label className="text-[10px] text-muted-foreground">Free spins per day</label>
          <Input type="number" value={config.free_spins_per_day} onChange={(e) => setConfig({ ...config, free_spins_per_day: +e.target.value })} className="h-8 text-xs" />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={async () => {
          await updateSetting.mutateAsync({ key: "spin_config", value: config });
          toast({ title: "Spin config saved" });
        }}>
          <Save className="w-3 h-3 me-1" /> Save Config
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Add Prize</h3>
        <Input placeholder="Label (e.g. 100 TON)" value={newPrize.label} onChange={(e) => setNewPrize({ ...newPrize, label: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Image URL (optional)" value={newPrize.image_url} onChange={(e) => setNewPrize({ ...newPrize, image_url: e.target.value })} className="h-8 text-xs" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Amount</label>
            <Input type="number" step="0.01" value={newPrize.amount} onChange={(e) => setNewPrize({ ...newPrize, amount: +e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Weight</label>
            <Input type="number" value={newPrize.weight} onChange={(e) => setNewPrize({ ...newPrize, weight: +e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">XP</label>
            <Input type="number" value={newPrize.xp_reward} onChange={(e) => setNewPrize({ ...newPrize, xp_reward: +e.target.value })} className="h-8 text-xs" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Currency</label>
          <Select value={newPrize.currency_id || "none"} onValueChange={(v) => setNewPrize({ ...newPrize, currency_id: v === "none" ? "" : v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default (Points)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default (Points)</SelectItem>
              {(currencies || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.symbol}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={addPrize}>
          <Plus className="w-3 h-3 me-1" /> Add Prize
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold px-1">Prizes</h3>
        {(prizes || []).map((p: any) => (
          <div key={p.id} className="glass-card rounded-xl p-2 flex items-center gap-2">
            {p.image_url ? <img src={p.image_url} className="w-8 h-8 rounded" alt="" /> : <div className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center"><Sparkles className="w-4 h-4 text-accent" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{p.label}</p>
              <p className="text-[10px] text-muted-foreground">{p.amount} {p.currencies?.symbol || ""} • w:{p.weight} • +{p.xp_reward}xp</p>
            </div>
            <Switch checked={p.is_active} onCheckedChange={() => toggle(p.id, p.is_active)} />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delPrize(p.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
