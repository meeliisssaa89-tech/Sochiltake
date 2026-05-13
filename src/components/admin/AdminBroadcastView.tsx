import { useState } from "react";
import { useBroadcast } from "@/hooks/useSupabaseData";
import { useAppSettings } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, Trash2, Rocket } from "lucide-react";

interface BroadcastButton {
  text: string;
  url: string;
  type: "url" | "webapp";
}

export function AdminBroadcastView() {
  const { toast } = useToast();
  const broadcast = useBroadcast();
  const { data: settings } = useAppSettings();
  const [message, setMessage] = useState("");
  const [parseMode, setParseMode] = useState("HTML");
  const [mediaType, setMediaType] = useState<string>("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [buttons, setButtons] = useState<BroadcastButton[]>([]);

  const botUsername = (settings?.bot_username as string) || "";
  const webappUrl   = (settings?.bot_webapp_url  as string) || "";

  const addOpenAppButton = () => {
    if (!botUsername && !webappUrl) {
      toast({ title: "Bot username not set", description: "Go to Settings → Bot Config to set your bot username first.", variant: "destructive" });
      return;
    }
    const url = webappUrl || `https://t.me/${botUsername}`;
    setButtons((prev) => [...prev, { text: "🚀 Open App", url, type: "webapp" }]);
  };

  const send = async () => {
    if (!message && !mediaUrl) {
      toast({ title: "Please enter a message or media URL", variant: "destructive" });
      return;
    }
    try {
      const res: any = await broadcast.mutateAsync({
        message,
        parse_mode: parseMode,
        media_url: mediaType !== "none" ? mediaUrl : undefined,
        media_type: mediaType !== "none" ? mediaType : undefined,
        buttons: buttons.filter((b) => b.text && b.url),
      });
      toast({ title: "Sent!", description: `${res.sent} sent, ${res.failed} failed` });
      setMessage(""); setMediaUrl(""); setButtons([]);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const updateButton = (i: number, field: keyof BroadcastButton, value: string) => {
    setButtons((prev) => {
      const x = [...prev];
      (x[i] as any)[field] = value;
      return x;
    });
  };

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-3 space-y-3">
        <h3 className="text-sm font-semibold">Broadcast Message to All Bot Users</h3>

        <div>
          <label className="text-[10px] text-muted-foreground">Message (supports HTML)</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="<b>Hello</b> 👋" className="text-xs" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Parse Mode</label>
            <Select value={parseMode} onValueChange={setParseMode}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HTML">HTML</SelectItem>
                <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Media Type</label>
            <Select value={mediaType} onValueChange={setMediaType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="animation">GIF / Animation</SelectItem>
                <SelectItem value="sticker">Sticker</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mediaType !== "none" && (
          <div>
            <label className="text-[10px] text-muted-foreground">Media URL or Telegram file_id</label>
            <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://... or CAACAg..." className="h-8 text-xs" />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground">Inline Buttons</label>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={addOpenAppButton}>
                <Rocket className="w-2.5 h-2.5" /> Open App
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setButtons([...buttons, { text: "", url: "", type: "url" }])}>
                <Plus className="w-3 h-3 me-1" /> URL
              </Button>
            </div>
          </div>

          {buttons.length > 0 && (
            <div className="text-[9px] text-muted-foreground px-0.5">
              "Open App" uses Web App button (opens mini app inline). "URL" opens a regular link.
            </div>
          )}

          {buttons.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <Select value={b.type} onValueChange={(v) => updateButton(i, "type", v)}>
                <SelectTrigger className="h-7 text-[10px] w-20 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webapp">App</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Button text" value={b.text} onChange={(e) => updateButton(i, "text", e.target.value)} className="h-7 text-xs" />
              <Input
                placeholder={b.type === "webapp" ? "https://..." : "https://..."}
                value={b.url}
                onChange={(e) => updateButton(i, "url", e.target.value)}
                className="h-7 text-xs"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {botUsername && (
          <p className="text-[9px] text-muted-foreground">
            Bot: @{botUsername} · Deep link: https://t.me/{botUsername}?startapp
          </p>
        )}

        <Button onClick={send} disabled={broadcast.isPending} className="w-full h-9 bg-accent hover:bg-accent/90 text-xs">
          <Send className="w-3 h-3 me-1" /> {broadcast.isPending ? "Sending..." : "Send to All Users"}
        </Button>
      </div>
    </div>
  );
}
