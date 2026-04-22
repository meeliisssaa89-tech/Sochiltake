import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting, useCurrencies } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

export function AdminSettingsView() {
  const { data: settings } = useAppSettings();
  const { data: currencies = [] } = useCurrencies();
  const update = useUpdateSetting();
  const { toast } = useToast();

  const [checkinDays, setCheckinDays] = useState<number[]>([50, 100, 150, 200, 250, 300, 500]);
  const [checkinCurrency, setCheckinCurrency] = useState<string>("TON");
  const [referral, setReferral] = useState({ amount: 100, xp: 50, text_en: "", text_ar: "" });
  const [symbol, setSymbol] = useState("TON");
  const [bot, setBot] = useState({ bot_username: "", bot_webapp_url: "" });

  useEffect(() => {
    if (settings?.checkin_rewards?.days) setCheckinDays(settings.checkin_rewards.days);
    if (settings?.checkin_currency_symbol) setCheckinCurrency(settings.checkin_currency_symbol);
    if (settings?.referral_reward) setReferral({ ...referral, ...settings.referral_reward });
    if (settings?.reward_currency_symbol) setSymbol(settings.reward_currency_symbol);
    setBot({ bot_username: settings?.bot_username || "", bot_webapp_url: settings?.bot_webapp_url || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = async (key: string, value: any, label: string) => {
    await update.mutateAsync({ key, value });
    toast({ title: `${label} saved` });
  };

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Reward Currency Symbol</h3>
        <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="h-8 text-xs" />
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => save("reward_currency_symbol", symbol, "Symbol")}>
          <Save className="w-3 h-3 me-1" /> Save Symbol
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Daily Check-in (Days 1-7)</h3>
        <div>
          <label className="text-[10px] text-muted-foreground">Reward Currency</label>
          <select
            value={checkinCurrency}
            onChange={(e) => setCheckinCurrency(e.target.value)}
            className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
          >
            {(currencies as any[]).map((c: any) => (
              <option key={c.id} value={c.symbol}>{c.name} ({c.symbol})</option>
            ))}
            {!(currencies as any[]).some((c: any) => c.symbol === checkinCurrency) && (
              <option value={checkinCurrency}>{checkinCurrency}</option>
            )}
          </select>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {checkinDays.map((val, i) => (
            <div key={i}>
              <p className="text-[9px] text-center text-muted-foreground">D{i + 1}</p>
              <Input type="number" value={val}
                onChange={(e) => { const x = [...checkinDays]; x[i] = +e.target.value; setCheckinDays(x); }}
                className="h-7 text-xs text-center p-0" />
            </div>
          ))}
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={async () => {
          await update.mutateAsync({ key: "checkin_rewards", value: { days: checkinDays } });
          await update.mutateAsync({ key: "checkin_currency_symbol", value: checkinCurrency });
          toast({ title: "Check-in saved" });
        }}>
          <Save className="w-3 h-3 me-1" /> Save Check-in
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Referral Reward</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Reward amount</label>
            <Input type="number" value={referral.amount} onChange={(e) => setReferral({ ...referral, amount: +e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">XP reward</label>
            <Input type="number" value={referral.xp} onChange={(e) => setReferral({ ...referral, xp: +e.target.value })} className="h-8 text-xs" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Front-end text (English)</label>
          <Textarea value={referral.text_en} onChange={(e) => setReferral({ ...referral, text_en: e.target.value })} rows={2} className="text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">نص الواجهة (عربي)</label>
          <Textarea value={referral.text_ar} onChange={(e) => setReferral({ ...referral, text_ar: e.target.value })} rows={2} className="text-xs" />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => save("referral_reward", referral, "Referral")}>
          <Save className="w-3 h-3 me-1" /> Save Referral
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Bot Settings</h3>
        <div>
          <label className="text-[10px] text-muted-foreground">Bot username (without @)</label>
          <Input value={bot.bot_username} onChange={(e) => setBot({ ...bot, bot_username: e.target.value })} className="h-8 text-xs" placeholder="Eg_Token_bot" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">WebApp URL</label>
          <Input value={bot.bot_webapp_url} onChange={(e) => setBot({ ...bot, bot_webapp_url: e.target.value })} className="h-8 text-xs" />
        </div>
        <Button size="sm" className="w-full h-8 text-xs" onClick={async () => {
          await update.mutateAsync({ key: "bot_username", value: bot.bot_username });
          await update.mutateAsync({ key: "bot_webapp_url", value: bot.bot_webapp_url });
          toast({ title: "Bot settings saved" });
        }}>
          <Save className="w-3 h-3 me-1" /> Save Bot
        </Button>
      </div>
    </div>
  );
}
