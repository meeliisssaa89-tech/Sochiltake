import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Wallet } from "lucide-react";

export function AdminWalletView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [config, setConfig] = useState({ enabled: true, moralis_api_key: "", coingecko_api_key: "", price_refresh_minutes: 5 });
  useEffect(() => { if (settings?.wallet_config) setConfig({ ...config, ...settings.wallet_config }); /* eslint-disable-next-line */ }, [settings]);

  const { data: tokens } = useQuery({
    queryKey: ["wallet-tokens-admin"],
    queryFn: async () => (await supabase.from("wallet_tokens").select("*").order("sort_order")).data || [],
  });

  const [newToken, setNewToken] = useState({ symbol: "", name: "", icon_url: "", contract_address: "", chain: "ethereum", price_api_url: "", price_usd: 0, decimals: 18 });

  const addToken = async () => {
    if (!newToken.symbol || !newToken.name) return;
    await supabase.from("wallet_tokens").insert({ ...newToken, is_active: true, sort_order: (tokens?.length || 0) });
    qc.invalidateQueries({ queryKey: ["wallet-tokens-admin"] });
    qc.invalidateQueries({ queryKey: ["wallet-tokens"] });
    setNewToken({ symbol: "", name: "", icon_url: "", contract_address: "", chain: "ethereum", price_api_url: "", price_usd: 0, decimals: 18 });
    toast({ title: "Token added" });
  };

  const updatePrice = async (id: string, price: number) => {
    await supabase.from("wallet_tokens").update({ price_usd: price, updated_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["wallet-tokens-admin"] });
    qc.invalidateQueries({ queryKey: ["wallet-tokens"] });
  };

  const del = async (id: string) => {
    await supabase.from("wallet_tokens").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["wallet-tokens-admin"] });
    qc.invalidateQueries({ queryKey: ["wallet-tokens"] });
  };

  const toggle = async (id: string, v: boolean) => {
    await supabase.from("wallet_tokens").update({ is_active: !v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["wallet-tokens-admin"] });
    qc.invalidateQueries({ queryKey: ["wallet-tokens"] });
  };

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Wallet APIs</h3>
        <label className="flex items-center justify-between text-xs">
          Wallet enabled
          <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
        </label>
        <div>
          <label className="text-[10px] text-muted-foreground">Moralis API Key (for on-chain balances)</label>
          <Input value={config.moralis_api_key} onChange={(e) => setConfig({ ...config, moralis_api_key: e.target.value })} className="h-8 text-xs" placeholder="eyJ..." />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">CoinGecko API Key (for prices)</label>
          <Input value={config.coingecko_api_key} onChange={(e) => setConfig({ ...config, coingecko_api_key: e.target.value })} className="h-8 text-xs" placeholder="CG-..." />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Price refresh (minutes)</label>
          <Input type="number" value={config.price_refresh_minutes} onChange={(e) => setConfig({ ...config, price_refresh_minutes: +e.target.value })} className="h-8 text-xs" />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={async () => {
          await updateSetting.mutateAsync({ key: "wallet_config", value: config });
          toast({ title: "Wallet config saved" });
        }}>
          <Save className="w-3 h-3 me-1" /> Save Config
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Add Token</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Symbol (BTC)" value={newToken.symbol} onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value })} className="h-8 text-xs" />
          <Input placeholder="Name (Bitcoin)" value={newToken.name} onChange={(e) => setNewToken({ ...newToken, name: e.target.value })} className="h-8 text-xs" />
        </div>
        <Input placeholder="Icon URL" value={newToken.icon_url} onChange={(e) => setNewToken({ ...newToken, icon_url: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Contract address (optional)" value={newToken.contract_address} onChange={(e) => setNewToken({ ...newToken, contract_address: e.target.value })} className="h-8 text-xs" />
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Chain" value={newToken.chain} onChange={(e) => setNewToken({ ...newToken, chain: e.target.value })} className="h-8 text-xs" />
          <Input type="number" placeholder="Decimals" value={newToken.decimals} onChange={(e) => setNewToken({ ...newToken, decimals: +e.target.value })} className="h-8 text-xs" />
          <Input type="number" step="0.0001" placeholder="Price USD" value={newToken.price_usd} onChange={(e) => setNewToken({ ...newToken, price_usd: +e.target.value })} className="h-8 text-xs" />
        </div>
        <Input placeholder="Price API URL (optional, returns {usd:n})" value={newToken.price_api_url} onChange={(e) => setNewToken({ ...newToken, price_api_url: e.target.value })} className="h-8 text-xs" />
        <Button size="sm" className="w-full h-8 text-xs" onClick={addToken}>
          <Plus className="w-3 h-3 me-1" /> Add Token
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold px-1">Tokens</h3>
        {(tokens || []).map((t: any) => (
          <div key={t.id} className="glass-card rounded-xl p-2 flex items-center gap-2">
            {t.icon_url ? <img src={t.icon_url} className="w-8 h-8 rounded-full" alt="" /> : <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">{t.symbol[0]}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{t.symbol} • {t.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t.chain} • ${Number(t.price_usd).toFixed(4)}</p>
            </div>
            <Input type="number" step="0.0001" defaultValue={t.price_usd} onBlur={(e) => updatePrice(t.id, +e.target.value)} className="h-7 w-20 text-xs" />
            <Switch checked={t.is_active} onCheckedChange={() => toggle(t.id, t.is_active)} />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(t.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
