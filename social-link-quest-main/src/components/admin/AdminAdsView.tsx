import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";

export function AdminAdsView() {
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const update = useUpdateSetting();
  const { toast } = useToast();

  const [ads, setAds] = useState({
    enabled: true,
    daily_count: 10,
    reward_per_ad: 10,
    xp_per_ad: 5,
    duration_seconds: 15,
  });
  const [sdkHtml, setSdkHtml] = useState("");
  const [zones, setZones] = useState({ daily_ad_zone: "", task_ad_zone: "" });

  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (settings.ads_daily && typeof settings.ads_daily === "object") {
      setAds((prev) => ({ ...prev, ...(settings.ads_daily as object) }));
    }
    if (typeof settings.ads_sdk_html === "string") {
      setSdkHtml(settings.ads_sdk_html);
    }
    if (settings.ads_zones && typeof settings.ads_zones === "object") {
      setZones((prev) => ({ ...prev, ...(settings.ads_zones as object) }));
    }
  }, [settings]);

  const save = async (key: string, value: unknown) => {
    setSavingKey(key);
    try {
      await update.mutateAsync({ key, value });
      toast({ title: "Saved successfully" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Failed to save",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
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
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold">Daily Ads Settings</h3>
        <div className="flex items-center justify-between">
          <span className="text-xs">Enabled</span>
          <Switch
            checked={ads.enabled}
            onCheckedChange={(v) => setAds({ ...ads, enabled: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Daily count</label>
            <Input
              type="number"
              value={ads.daily_count}
              onChange={(e) => setAds({ ...ads, daily_count: +e.target.value })}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Reward per ad</label>
            <Input
              type="number"
              value={ads.reward_per_ad}
              onChange={(e) => setAds({ ...ads, reward_per_ad: +e.target.value })}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">XP per ad</label>
            <Input
              type="number"
              value={ads.xp_per_ad}
              onChange={(e) => setAds({ ...ads, xp_per_ad: +e.target.value })}
              className="h-8"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Duration (sec)</label>
            <Input
              type="number"
              value={ads.duration_seconds}
              onChange={(e) =>
                setAds({ ...ads, duration_seconds: +e.target.value })
              }
              className="h-8"
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => save("ads_daily", ads)}
          disabled={savingKey === "ads_daily"}
          className="w-full h-8 text-xs"
        >
          {savingKey === "ads_daily" ? (
            <Loader2 className="w-3 h-3 me-1 animate-spin" />
          ) : (
            <Save className="w-3 h-3 me-1" />
          )}
          Save Ads Config
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">
          Ads SDK (paste raw HTML / script tags)
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Paste the ad network's SDK script here. It will be injected into the
          app's &lt;head&gt; automatically.
        </p>
        <Textarea
          value={sdkHtml}
          onChange={(e) => setSdkHtml(e.target.value)}
          rows={5}
          className="text-xs font-mono"
          placeholder='<script src="https://example.com/sdk.js"></script>'
        />
        <Button
          size="sm"
          onClick={() => save("ads_sdk_html", sdkHtml)}
          disabled={savingKey === "ads_sdk_html"}
          className="w-full h-8 text-xs"
        >
          {savingKey === "ads_sdk_html" ? (
            <Loader2 className="w-3 h-3 me-1 animate-spin" />
          ) : (
            <Save className="w-3 h-3 me-1" />
          )}
          Save SDK
        </Button>
      </div>

      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold">Ad Zone IDs</h3>
        <div>
          <label className="text-[10px] text-muted-foreground">
            Daily ad zone ID / function name
          </label>
          <Input
            value={zones.daily_ad_zone}
            onChange={(e) =>
              setZones({ ...zones, daily_ad_zone: e.target.value })
            }
            className="h-8"
            placeholder="show_12345"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">
            Task ad zone ID / function name
          </label>
          <Input
            value={zones.task_ad_zone}
            onChange={(e) =>
              setZones({ ...zones, task_ad_zone: e.target.value })
            }
            className="h-8"
            placeholder="show_67890"
          />
        </div>
        <Button
          size="sm"
          onClick={() => save("ads_zones", zones)}
          disabled={savingKey === "ads_zones"}
          className="w-full h-8 text-xs"
        >
          {savingKey === "ads_zones" ? (
            <Loader2 className="w-3 h-3 me-1 animate-spin" />
          ) : (
            <Save className="w-3 h-3 me-1" />
          )}
          Save Zones
        </Button>
      </div>
    </div>
  );
}
