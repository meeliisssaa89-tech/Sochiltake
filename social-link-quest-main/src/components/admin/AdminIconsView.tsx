import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { Image as ImageIcon } from "lucide-react";

const ICON_KEYS = [
  { key: "nav_home", label: "Bottom Nav: Home" },
  { key: "nav_tasks", label: "Bottom Nav: Tasks" },
  { key: "nav_leaderboard", label: "Bottom Nav: Leaderboard" },
  { key: "nav_activity", label: "Bottom Nav: Activity" },
  { key: "nav_profile", label: "Bottom Nav: Profile" },
  { key: "section_checkin", label: "Section: Daily Check-in" },
  { key: "section_ads", label: "Section: Daily Ads" },
  { key: "section_tasks", label: "Section: Required Tasks" },
  { key: "section_guide", label: "Section: Official Guide" },
  { key: "section_invite", label: "Section: Invite Friends" },
];

export function AdminIconsView() {
  const { data: settings } = useAppSettings();
  const update = useUpdateSetting();
  const { toast } = useToast();
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    setIcons((settings?.app_icons as Record<string, string>) || {});
  }, [settings]);

  const save = async () => {
    await update.mutateAsync({ key: "app_icons", value: icons });
    toast({ title: "Icons saved" });
  };

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-3">
        <p className="text-[10px] text-muted-foreground mb-2">
          Paste an image / GIF URL for each slot. Leave empty to use the default icon. GIFs play once on tap.
        </p>
        <div className="space-y-2">
          {ICON_KEYS.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <AppIcon src={icons[item.key]} fallback={ImageIcon} className="w-8 h-8" size={32} />
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">{item.label}</label>
                <Input
                  value={icons[item.key] || ""}
                  onChange={(e) => setIcons({ ...icons, [item.key]: e.target.value })}
                  placeholder="https://..."
                  className="h-7 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button onClick={save} size="sm" className="w-full h-9 text-xs">
        <Save className="w-3 h-3 me-1" /> Save All Icons
      </Button>
    </div>
  );
}
