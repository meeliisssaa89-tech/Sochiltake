import { useState } from "react";
import { useBroadcast } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, Trash2 } from "lucide-react";

export function AdminBroadcastView() {
  const { toast } = useToast();
  const broadcast = useBroadcast();
  const [message, setMessage] = useState("");
  const [parseMode, setParseMode] = useState("HTML");
  const [mediaType, setMediaType] = useState<string>("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [buttons, setButtons] = useState<{ text: string; url: string }[]>([]);

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
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setButtons([...buttons, { text: "", url: "" }])}>
              <Plus className="w-3 h-3 me-1" /> Add
            </Button>
          </div>
          {buttons.map((b, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input placeholder="Text" value={b.text} onChange={(e) => { const x = [...buttons]; x[i].text = e.target.value; setButtons(x); }} className="h-7 text-xs" />
              <Input placeholder="URL" value={b.url} onChange={(e) => { const x = [...buttons]; x[i].url = e.target.value; setButtons(x); }} className="h-7 text-xs" />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={send} disabled={broadcast.isPending} className="w-full h-9 bg-accent hover:bg-accent/90 text-xs">
          <Send className="w-3 h-3 me-1" /> {broadcast.isPending ? "Sending..." : "Send to All Users"}
        </Button>
      </div>
    </div>
  );
}
