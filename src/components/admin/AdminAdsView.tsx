import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting, useCurrencies } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Zap, Link2, Plus, Trash2 } from "lucide-react";

interface PlatformConfig {
  enabled: boolean;
  block_id: string;
  block_ids: string[];
  zone_id: string;
  sdk_html: string;
  debug?: boolean;
}

interface AdsConfig {
  daily_count: number;
  reward_per_ad: number;
  xp_per_ad: number;
  duration_seconds: number;
  enabled: boolean;
  direct_link: string;
  bulk_reward_mode: boolean;
  completion_reward: number;
}

interface ButtonBindings {
  daily_ads: string;
  tasks_page: string;
  home_checkin: string;
  spin_button: string;
  promo_redeem: string;
  social_link_start: string;
}

const defaultPlatform: PlatformConfig = {
  enabled: false,
  block_id: "",
  block_ids: [],
  zone_id: "",
  sdk_html: "",
  debug: false,
};

const PLATFORMS = [
  { key: "adgram", label: "Adgram", desc: "Telegram-native ad network", color: "text-blue-400" },
  { key: "montag", label: "Monetag", desc: "Multi-format ad network", color: "text-green-400" },
  { key: "custom", label: "Custom / Other", desc: "Any other SDK", color: "text-purple-400" },
];

const BUTTON_SLOTS = [
  { key: "daily_ads", label: "Daily Ads Card — Watch button" },
  { key: "tasks_page", label: "Tasks Page — ad button" },
  { key: "home_checkin", label: "Home Page — check-in bonus button" },
  { key: "spin_button", label: "Spin Wheel — show ad before spin" },
  { key: "promo_redeem", label: "Promo Code — show ad before redeem" },
  { key: "social_link_start", label: "Social Tasks — show ad before opening link" },
];

export function AdminAdsView() {
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const { data: currencies = [] } = useCurrencies();
  const update = useUpdateSetting();
  const { toast } = useToast();

  const [ads, setAds] = useState<AdsConfig>({
    enabled: true,
    daily_count: 10,
    reward_per_ad: 10,
    xp_per_ad: 5,
    duration_seconds: 15,
    direct_link: "",
  });
  const [rewardCurrencySymbol, setRewardCurrencySymbol] = useState<string>("");

  const [platforms, setPlatforms] = useState<Record<string, PlatformConfig>>({
    adgram: { ...defaultPlatform },
    montag: { ...defaultPlatform },
    custom: { ...defaultPlatform },
  });

  const [bindings, setBindings] = useState<ButtonBindings>({
    daily_ads: "none",
    tasks_page: "none",
    home_checkin: "none",
    spin_button: "none",
    promo_redeem: "none",
    social_link_start: "none",
  });

  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (settings.ads_daily && typeof settings.ads_daily === "object") {
      const d = settings.ads_daily as any;
      setAds((prev) => ({ ...prev, ...d }));
      if (d.reward_currency_symbol) setRewardCurrencySymbol(d.reward_currency_symbol);
    }
    if (settings.ads_platforms && typeof settings.ads_platforms === "object") {
      const saved = settings.ads_platforms as Record<string, any>;
      setPlatforms((prev) => {
        const merged: Record<string, PlatformConfig> = { ...prev };
        for (const k of Object.keys(saved)) {
          merged[k] = {
            ...defaultPlatform,
            ...saved[k],
            block_ids: Array.isArray(saved[k]?.block_ids)
              ? saved[k].block_ids
              : saved[k]?.block_id
              ? [saved[k].block_id]
              : [],
          };
        }
        return merged;
      });
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

  const addBlockId = (platformKey: string) => {
    const ids = [...(platforms[platformKey]?.block_ids || []), ""];
    updatePlatform(platformKey, "block_ids", ids);
  };

  const removeBlockId = (platformKey: string, idx: number) => {
    const ids = (platforms[platformKey]?.block_ids || []).filter((_, i) => i !== idx);
    updatePlatform(platformKey, "block_ids", ids);
  };

  const updateBlockId = (platformKey: string, idx: number, val: string) => {
    const ids = [...(platforms[platformKey]?.block_ids || [])];
    ids[idx] = val;
    updatePlatform(platformKey, "block_ids", ids);
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
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Bulk Reward Mode</p>
                <p className="text-[9px] text-muted-foreground/60">Credit one total reward when ALL ads are watched (instead of per-ad)</p>
              </div>
              <Switch checked={ads.bulk_reward_mode || false} onCheckedChange={(v) => setAds({ ...ads, bulk_reward_mode: v })} />
            </div>
            {ads.bulk_reward_mode && (
              <div>
                <label className="text-[10px] text-muted-foreground">Completion Reward (total amount)</label>
                <Input type="number" value={ads.completion_reward || 0} onChange={(e) => setAds({ ...ads, completion_reward: +e.target.value })} className="h-8" placeholder="e.g. 1" />
              </div>
            )}
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

        <div>
          <label className="text-[10px] text-muted-foreground font-medium">Direct Link (optional)</label>
          <p className="text-[9px] text-muted-foreground/70 mb-1">
            عند الضغط على "مشاهدة إعلان" يفتح هذا الرابط في تبويب جديد بالتوازي مع تشغيل الإعلانات. اتركه فارغًا للتعطيل.
          </p>
          <Input
            value={ads.direct_link}
            onChange={(e) => setAds({ ...ads, direct_link: e.target.value })}
            placeholder="https://example.com/your-direct-link"
            className="h-8 text-xs"
          />
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground font-medium">Reward Currency</label>
          <p className="text-[9px] text-muted-foreground/70 mb-1">Which currency users earn per ad watched</p>
          <select
            value={rewardCurrencySymbol}
            onChange={(e) => setRewardCurrencySymbol(e.target.value)}
            className="w-full h-8 text-xs rounded-lg border border-border bg-card px-2"
          >
            <option value="">-- Select currency --</option>
            {(currencies as any[]).map((c: any) => (
              <option key={c.id} value={c.symbol}>{c.name} ({c.symbol})</option>
            ))}
          </select>
        </div>

        <Button size="sm" onClick={() => save("ads_daily", { ...ads, reward_currency_symbol: rewardCurrencySymbol })} disabled={savingKey === "ads_daily"} className="w-full h-8 text-xs">
          {savingKey === "ads_daily" ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
          Save Settings
        </Button>
      </div>

      {/* Ad Platforms */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" /> Ad Platforms
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Enable each platform. When "All Platforms" is selected, Monetag runs first then Adgram sequentially before the reward is given.
        </p>
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
                    <div className="space-y-2">
                      {/* Multiple Block IDs */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-muted-foreground font-medium">
                            Block IDs
                            <span className="ms-1 text-[9px] text-muted-foreground/60">
                              (each ad slot rotates through these)
                            </span>
                          </label>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 gap-1"
                            onClick={() => addBlockId(key)}
                          >
                            <Plus className="w-3 h-3" /> Add Block ID
                          </Button>
                        </div>

                        {(cfg.block_ids || []).length === 0 && (
                          <p className="text-[9px] text-muted-foreground/60 bg-secondary/40 rounded p-2 text-center">
                            No Block IDs added yet. Click "Add Block ID" to add one.
                          </p>
                        )}

                        {(cfg.block_ids || []).map((bid, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground w-5 shrink-0 text-right">
                              {idx + 1}.
                            </span>
                            <Input
                              value={bid}
                              onChange={(e) => updateBlockId(key, idx, e.target.value)}
                              className="h-7 text-xs flex-1"
                              placeholder={`Block ID ${idx + 1} — e.g. int-26108`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => removeBlockId(key, idx)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}

                        {(cfg.block_ids || []).length > 1 && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                            <p className="text-[9px] text-blue-400">
                              <strong>كيف يعمل:</strong> عند الضغط على الزر يتم عرض <strong>جميع</strong> Block IDs بالتسلسل (الأول ثم الثاني ثم الثالث...) في نفس الجلسة قبل إعطاء المكافأة.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Debug Mode */}
                      <div className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                        <div>
                          <p className="text-[10px] text-yellow-500 font-medium">Debug Mode (Test Ads)</p>
                          <p className="text-[9px] text-muted-foreground">Enable to bypass URL validation. Disable in production.</p>
                        </div>
                        <Switch checked={cfg.debug || false} onCheckedChange={(v) => updatePlatform(key, "debug", v)} />
                      </div>

                      <p className="text-[9px] text-muted-foreground/70 bg-secondary/60 rounded p-1.5">
                        For production: register this URL in Adsgram's dashboard:{" "}
                        <code className="text-[8px] break-all text-primary">{window.location.origin}</code>
                      </p>
                    </div>
                  )}

                  {key === "montag" && (
                    <div className="space-y-1.5">
                      <div>
                        <label className="text-[10px] text-muted-foreground">App / Zone ID</label>
                        <Input
                          value={cfg.zone_id}
                          onChange={(e) => updatePlatform(key, "zone_id", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="e.g. 9876543"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">SDK Script (injected in &lt;head&gt;)</label>
                        <Textarea
                          value={cfg.sdk_html}
                          onChange={(e) => updatePlatform(key, "sdk_html", e.target.value)}
                          rows={3}
                          className="text-xs font-mono"
                          placeholder={'<script src="https://...monetag..."></script>'}
                        />
                        <p className="text-[9px] text-muted-foreground/70 mt-1">
                          Paste the Monetag SDK script tag here. It will be auto-injected into the page head.
                        </p>
                      </div>
                    </div>
                  )}

                  {key === "custom" && (
                    <>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Zone / Function name</label>
                        <Input
                          value={cfg.zone_id}
                          onChange={(e) => updatePlatform(key, "zone_id", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="show_12345"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">SDK Script (injected in &lt;head&gt;)</label>
                        <Textarea
                          value={cfg.sdk_html}
                          onChange={(e) => updatePlatform(key, "sdk_html", e.target.value)}
                          rows={3}
                          className="text-xs font-mono"
                          placeholder='<script src="..."></script>'
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
        <Button
          size="sm"
          onClick={() => save("ads_platforms", platforms)}
          disabled={savingKey === "ads_platforms"}
          className="w-full h-8 text-xs"
        >
          {savingKey === "ads_platforms" ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
          Save All Platforms
        </Button>
      </div>

      {/* Button Bindings */}
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> Button Bindings
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Choose which ad platform each button triggers. Use <strong>All Platforms</strong> to run Monetag then Adgram in sequence.
        </p>
        {BUTTON_SLOTS.map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] text-muted-foreground">{label}</label>
            <select
              value={(bindings as any)[key] || "none"}
              onChange={(e) => setBindings({ ...bindings, [key]: e.target.value })}
              className="w-full h-8 text-xs rounded-lg border border-border bg-card px-2 mt-0.5"
            >
              <option value="all">All Platforms (Adgram → Monetag)</option>
              <option value="adgram">Adgram only</option>
              <option value="montag">Monetag only</option>
              <option value="custom">Custom / Other</option>
              <option value="none">None (fallback timer)</option>
            </select>
          </div>
        ))}
        <Button
          size="sm"
          onClick={() => save("ads_bindings", bindings)}
          disabled={savingKey === "ads_bindings"}
          className="w-full h-8 text-xs"
        >
          {savingKey === "ads_bindings" ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
          Save Bindings
        </Button>
      </div>

      {/* ── Popup Tasks & Prize Draw ── */}
      <div className="glass-card rounded-xl p-3">
        <PopupTasksSection save={save} savingKey={savingKey} settings={settings as any} />
      </div>
    </div>
  );
}

function PopupTasksSection({
  save,
  savingKey,
  settings,
}: {
  save: (key: string, value: unknown) => Promise<void>;
  savingKey: string | null;
  settings: any;
}) {
  const [enabled, setEnabled] = useState(false);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [newTaskId, setNewTaskId] = useState("");
  const [prizeEnabled, setPrizeEnabled] = useState(false);
  const [prizeDesc, setPrizeDesc] = useState("");
  const [prizeDate, setPrizeDate] = useState("");

  useEffect(() => {
    if (!settings?.popup_tasks_config) return;
    const cfg = settings.popup_tasks_config;
    setEnabled(cfg.enabled ?? false);
    setTaskIds(Array.isArray(cfg.task_ids) ? cfg.task_ids : []);
    setPrizeEnabled(cfg.prize_draw_enabled ?? false);
    setPrizeDesc(cfg.prize_description || "");
    setPrizeDate(cfg.prize_draw_date || "");
  }, [settings]);

  const savePopup = () =>
    save("popup_tasks_config", {
      enabled,
      task_ids: taskIds,
      prize_draw_enabled: prizeEnabled,
      prize_description: prizeDesc,
      prize_draw_date: prizeDate,
    });

  return (
    <div className="space-y-2 p-3 bg-secondary/40 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-primary">Popup Tasks &amp; Prize Draw</p>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Show selected tasks as a popup modal to users (once every 3 hours). Add task IDs from the Tasks panel.
      </p>

      {/* Task IDs */}
      <div className="space-y-1.5">
        {taskIds.map((id, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={id}
              onChange={(e) => {
                const next = [...taskIds];
                next[idx] = e.target.value;
                setTaskIds(next);
              }}
              className="h-7 text-xs flex-1 font-mono"
              placeholder="task-uuid"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => setTaskIds(taskIds.filter((_, i) => i !== idx))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={newTaskId}
            onChange={(e) => setNewTaskId(e.target.value)}
            className="h-7 text-xs flex-1 font-mono"
            placeholder="Paste task UUID here…"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] px-2"
            onClick={() => {
              if (newTaskId.trim()) {
                setTaskIds([...taskIds, newTaskId.trim()]);
                setNewTaskId("");
              }
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Prize Draw */}
      <div className="space-y-1.5 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-yellow-400">Prize Draw</p>
          <Switch checked={prizeEnabled} onCheckedChange={setPrizeEnabled} />
        </div>
        {prizeEnabled && (
          <>
            <Input
              value={prizeDesc}
              onChange={(e) => setPrizeDesc(e.target.value)}
              className="h-8 text-xs"
              placeholder="e.g. iPhone 16 Pro — join to win!"
            />
            <Input
              value={prizeDate}
              onChange={(e) => setPrizeDate(e.target.value)}
              className="h-8 text-xs"
              placeholder="Draw date: e.g. 31 Dec 2025"
            />
          </>
        )}
      </div>

      <Button
        size="sm"
        onClick={savePopup}
        disabled={savingKey === "popup_tasks_config"}
        className="w-full h-8 text-xs"
      >
        {savingKey === "popup_tasks_config" ? (
          <Loader2 className="w-3 h-3 me-1 animate-spin" />
        ) : (
          <Save className="w-3 h-3 me-1" />
        )}
        Save Popup Config
      </Button>
    </div>
  );
}
