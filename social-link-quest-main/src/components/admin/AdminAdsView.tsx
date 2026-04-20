import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Zap, Link2 } from "lucide-react";

interface PlatformConfig {
  enabled: boolean;
  block_id: string;
  zone_id: string;
  sdk_html: string;
}

interface AdsConfig {
  daily_count: number;
  reward_per_ad: number;
  xp_per_ad: number;
  duration_seconds: number;
  enabled: boolean;
}

interface ButtonBindings {
  daily_ads: string;
  tasks_page: string;
  home_checkin: string;
}

const defaultPlatform: PlatformConfig = { enabled: false, block_id: "", zone_id: "", sdk_html: "" };

const PLATFORMS = [
  { key: "adgram", label: "Adgram", desc: "Telegram-native ad network", color: "text-blue-400" },
  { key: "montag", label: "Monetag", desc: "Multi-format ad network", color: "text-green-400" },
  { key: "custom", label: "Custom / Other", desc: "Any other SDK", color: "text-purple-400" },
];

const BUTTON_SLOTS = [
  { key: "daily_ads", label: "Daily Ads Card (Watch button)" },
  { key: "tasks_page", label: "Tasks Page ad button" },
  { key: "home_checkin", label: "Home Page (extra button)" },
];

export function AdminAdsView() {
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const update = useUpdateSetting();
  const { toast } = useToast();

  const [ads, setAds] = useState<AdsConfig>({
    enabled: true,
    daily_count: 10,
    reward_per_ad: 10,
    xp_per_ad: 5,
    duration_seconds: 15,
  });

  const [platforms, setPlatforms] = useState<Record<string, PlatformConfig>>({
    adgram: { ...defaultPlatform },
    montag: { ...defaultPlatform },
    custom: { ...defaultPlatform },
  });

  const [bindings, setBindings] = useState<ButtonBindings>({
    daily_ads: "custom",
    tasks_page: "custom",
    home_checkin: "custom",
  });

  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (settings.ads_daily && typeof settings.ads_daily === "object") {
      setAds((prev) => ({ ...prev, ...(settings.ads_daily as object) }));
    }
    if (settings.ads_platforms && typeof settings.ads_platforms === "object") {
      setPlatforms((prev) => ({ ...prev, ...(settings.ads_platforms as object) }));
    }
    if (settings.ads_bindings && typeof settings.ads_bindings === "object") {
      setBindings((prev) => ({ ...prev, ...(settings.ads_bindings as object) }));
    }
  }, [settings]);

  const save = async (key: string, value: unknown) => {
    setSavingKey(key);
    try {
      await update.mutateAsync({ key, value });
      toast({ title: "Saved successfully" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to save", description: message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const updatePlatform = (key: string, field: keyof PlatformConfig, value: any) => {
    setPlatforms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Daily Limits */}
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold">Daily Ad Settings</h3>
        <div className="flex items-center justify-between">
          <span className="text-xs">Ads Enabled</span>
          <Switch checked={ads.enabled} onCheckedChange={(v) => setAds({ ...ads, enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Daily limit</label>
            <Input type="number" value={ads.daily_count} onChange={(e) => setAds({ ...ads, daily_count: +e.target.value })} className="h-8" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Reward per ad</label>
            <Input type="number" value={ads.reward_per_ad} onChange={(e) => setAds({ ...ads, reward_per_ad: +e.target.value })} className="h-8" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">XP per ad</label>
            <Input type="number" value={ads.xp_per_ad} onChange={(e) => setAds({ ...ads, xp_per_ad: +e.target.value })} className="h-8" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Fallback duration (s)</label>
            <Input type="number" value={ads.duration_seconds} onChange={(e) => setAds({ ...ads, duration_seconds: +e.target.value })} className="h-8" />
          </div>
        </div>
        <Button size="sm" onClick={() => save("ads_daily", ads)} disabled={savingKey === "ads_daily"} className="w-full h-8 text-xs">
          {savingKey === "ads_daily" ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
          Save Settings
        </Button>
      </div>

      {/* Ad Platforms */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" /> Ad Platforms
        </h3>
        <p className="text-[10px] text-muted-foreground">Enable multiple platforms — they will all work simultaneously when users click the watch button.</p>
        {PLATFORMS.map(({ key, label, desc, color }) => {
          const cfg = platforms[key] || { ...defaultPlatform };
          return (
            <div key={key} className="glass-card rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-sm font-semibold ${color}`}>{label}</span>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  {cfg.enabled && <Badge className="text-[9px] bg-success/10 text-success border-0">Active</Badge>}
                  <Switch checked={cfg.enabled} onCheckedChange={(v) => updatePlatform(key, "enabled", v)} />
                </div>
              </div>
              {cfg.enabled && (
                <>
                  {key === "adgram" && (
                    <div>
                      <label className="text-[10px] text-muted-foreground">Block ID</label>
                      <Input value={cfg.block_id} onChange={(e) => updatePlatform(key, "block_id", e.target.value)} className="h-8 text-xs" placeholder="e.g. 1234" />
                    </div>
                  )}
                  {key === "montag" && (
                    <div>
                      <label className="text-[10px] text-muted-foreground">App / Zone ID</label>
                      <Input value={cfg.zone_id} onChange={(e) => updatePlatform(key, "zone_id", e.target.value)} className="h-8 text-xs" placeholder="e.g. 9876543" />
                    </div>
                  )}
                  {key === "custom" && (
                    <>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Zone / Function name</label>
                        <Input value={cfg.zone_id} onChange={(e) => updatePlatform(key, "zone_id", e.target.value)} className="h-8 text-xs" placeholder="show_12345" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">SDK Script (injected in &lt;head&gt;)</label>
                        <Textarea value={cfg.sdk_html} onChange={(e) => updatePlatform(key, "sdk_html", e.target.value)} rows={3} className="text-xs font-mono" placeholder='<script src="..."></script>' />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
        <Button size="sm" onClick={() => save("ads_platforms", platforms)} disabled={savingKey === "ads_platforms"} className="w-full h-8 text-xs">
          {savingKey === "ads_platforms" ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
          Save All Platforms
        </Button>
      </div>

      {/* Button Bindings */}
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> Button Bindings
        </h3>
        <p className="text-[10px] text-muted-foreground">Link each button to the ad platform it should trigger.</p>
        {BUTTON_SLOTS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] text-muted-foreground">{label}</label>
            <select
              value={(bindings as any)[key] || "custom"}
              onChange={(e) => setBindings({ ...bindings, [key]: e.target.value })}
              className="w-full h-8 text-xs rounded-lg border border-border bg-card px-2 mt-0.5"
            >
              <option value="adgram">Adgram</option>
              <option value="montag">Monetag</option>
              <option value="custom">Custom / Other</option>
              <option value="none">None (fallback timer)</option>
            </select>
          </div>
        ))}
        <Button size="sm" onClick={() => save("ads_bindings", bindings)} disabled={savingKey === "ads_bindings"} className="w-full h-8 text-xs">
          {savingKey === "ads_bindings" ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
          Save Bindings
        </Button>
      </div>
    </div>
  );
}
