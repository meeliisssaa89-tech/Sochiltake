import { useState, useEffect, useRef } from "react";
import { useAppSettings, useUpdateSetting, useUploadImage } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Loader2, ImagePlus, X } from "lucide-react";
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

function UploadButton({
  onUploaded,
  uploadPath,
}: {
  onUploaded: (url: string) => void;
  uploadPath: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${uploadPath}-${Date.now()}.${ext}`;
      const url = await upload.mutateAsync({ file, path });
      onUploaded(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7 shrink-0"
        title="Upload image"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Upload className="w-3 h-3" />
        )}
      </Button>
    </>
  );
}

export function AdminIconsView() {
  const { data: settings } = useAppSettings();
  const update = useUpdateSetting();
  const uploadLogo = useUploadImage();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [icons, setIcons] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState("");
  const [savingIcons, setSavingIcons] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setIcons((settings?.app_icons as Record<string, string>) || {});
    const logo = settings?.app_logo_url;
    if (logo && typeof logo === "string" && logo !== "null") {
      setLogoUrl(logo);
    }
  }, [settings]);

  const saveIcons = async () => {
    setSavingIcons(true);
    try {
      await update.mutateAsync({ key: "app_icons", value: icons });
      toast({ title: "Icons saved successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Failed to save icons", description: msg, variant: "destructive" });
    } finally {
      setSavingIcons(false);
    }
  };

  const saveLogo = async (url: string) => {
    setSavingLogo(true);
    try {
      await update.mutateAsync({ key: "app_logo_url", value: url });
      setLogoUrl(url);
      toast({ title: "Logo saved successfully" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Failed to save logo", description: msg, variant: "destructive" });
    } finally {
      setSavingLogo(false);
    }
  };

  const handleLogoFile = async (file: File) => {
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo/app-logo-${Date.now()}.${ext}`;
      const url = await uploadLogo.mutateAsync({ file, path });
      await saveLogo(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Logo upload failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {/* App Logo Section */}
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-primary" />
          App Logo
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Upload or paste a URL for the main app logo. Displayed in the header and splash screen.
        </p>

        {/* Logo Preview */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center overflow-hidden border border-border">
            {logoUrl ? (
              <img src={logoUrl} alt="App Logo" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://... or upload below"
                className="h-8 text-xs flex-1"
              />
              {logoUrl && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setLogoUrl("")}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {/* Upload file */}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs flex-1"
                disabled={uploadLogo.isPending}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadLogo.isPending ? (
                  <Loader2 className="w-3 h-3 me-1 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3 me-1" />
                )}
                Upload Image
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs flex-1"
                disabled={savingLogo || uploadLogo.isPending}
                onClick={() => saveLogo(logoUrl)}
              >
                {savingLogo ? (
                  <Loader2 className="w-3 h-3 me-1 animate-spin" />
                ) : (
                  <Save className="w-3 h-3 me-1" />
                )}
                Save Logo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation & Section Icons */}
      <div className="glass-card rounded-xl p-3">
        <p className="text-[10px] text-muted-foreground mb-3">
          Paste an image / GIF URL or upload a file for each slot. Leave empty to use the default
          icon. GIFs play once on tap.
        </p>
        <div className="space-y-2">
          {ICON_KEYS.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <AppIcon
                src={icons[item.key]}
                fallback={ImageIcon}
                className="w-8 h-8 rounded shrink-0"
                size={32}
              />
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-muted-foreground">{item.label}</label>
                <Input
                  value={icons[item.key] || ""}
                  onChange={(e) => setIcons({ ...icons, [item.key]: e.target.value })}
                  placeholder="https://... or upload →"
                  className="h-7 text-xs"
                />
              </div>
              <UploadButton
                uploadPath={`icons/${item.key}`}
                onUploaded={(url) => setIcons({ ...icons, [item.key]: url })}
              />
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={saveIcons}
        disabled={savingIcons}
        size="sm"
        className="w-full h-9 text-xs"
      >
        {savingIcons ? (
          <Loader2 className="w-3 h-3 me-1 animate-spin" />
        ) : (
          <Save className="w-3 h-3 me-1" />
        )}
        Save All Icons
      </Button>
    </div>
  );
}
