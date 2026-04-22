import { useState, useEffect } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Loader2, Bot, Webhook, Info, Trash2, CheckCircle2,
  XCircle, RefreshCw, Copy, ExternalLink,
} from "lucide-react";

interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

const TG_API = (token: string) => `https://api.telegram.org/bot${token}`;

export function AdminBotView() {
  const { data: settings } = useAppSettings();
  const update = useUpdateSetting();
  const { toast } = useToast();

  const [token, setToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [miniAppUrl, setMiniAppUrl] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [secretToken, setSecretToken] = useState("");

  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setToken((settings as any).bot_token || "");
    setWebhookUrl((settings as any).bot_webhook_url || window.location.origin + "/api/bot");
    setMiniAppUrl((settings as any).bot_webapp_url || "");
    setBotUsername((settings as any).bot_username || "");
    setSecretToken((settings as any).bot_webhook_secret || "");
  }, [settings]);

  const callTg = async (method: string, body?: Record<string, unknown>) => {
    if (!token.trim()) {
      toast({ title: "Bot token required", variant: "destructive" });
      return null;
    }
    const url = `${TG_API(token.trim())}/${method}`;
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const handleGetBotInfo = async () => {
    setLoading("info");
    try {
      const data = await callTg("getMe");
      if (data?.ok) {
        setBotInfo(data.result);
        setBotUsername(data.result.username);
        toast({ title: `@${data.result.username}`, description: data.result.first_name });
      } else {
        toast({ title: "Failed", description: data?.description || "Invalid token?", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleGetWebhookInfo = async () => {
    setLoading("whinfo");
    try {
      const data = await callTg("getWebhookInfo");
      if (data?.ok) {
        setWebhookInfo(data.result);
      } else {
        toast({ title: "Failed", description: data?.description, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleSetWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({ title: "Webhook URL required", variant: "destructive" });
      return;
    }
    setLoading("set");
    try {
      const body: Record<string, unknown> = {
        url: webhookUrl.trim(),
        allowed_updates: ["message", "callback_query", "inline_query", "my_chat_member"],
      };
      if (secretToken.trim()) body.secret_token = secretToken.trim();
      const data = await callTg("setWebhook", body);
      if (data?.ok) {
        toast({ title: "Webhook set successfully ✓" });
        setWebhookInfo(null);
        await handleGetWebhookInfo();
      } else {
        toast({ title: "Failed", description: data?.description, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteWebhook = async () => {
    setLoading("del");
    try {
      const data = await callTg("deleteWebhook", { drop_pending_updates: true });
      if (data?.ok) {
        toast({ title: "Webhook deleted" });
        setWebhookInfo(null);
        await handleGetWebhookInfo();
      } else {
        toast({ title: "Failed", description: data?.description, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update.mutateAsync({ key: "bot_token", value: token });
      await update.mutateAsync({ key: "bot_webhook_url", value: webhookUrl });
      await update.mutateAsync({ key: "bot_webapp_url", value: miniAppUrl });
      await update.mutateAsync({ key: "bot_username", value: botUsername });
      await update.mutateAsync({ key: "bot_webhook_secret", value: secretToken });
      toast({ title: "Bot settings saved ✓" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copy = (val: string) => {
    navigator.clipboard.writeText(val).then(() => toast({ title: "Copied!" }));
  };

  return (
    <div className="space-y-3">
      {/* Token & Basic Info */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" /> Bot Token
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Get it from @BotFather on Telegram.
        </p>
        <div className="flex gap-1.5">
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="h-8 text-xs flex-1"
            placeholder="1234567890:ABCdef..."
            data-testid="input-bot-token"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleGetBotInfo}
            disabled={loading === "info" || !token}
            className="h-8 text-xs shrink-0"
            data-testid="button-get-bot-info"
          >
            {loading === "info" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Info className="w-3 h-3" />}
          </Button>
        </div>

        {botInfo && (
          <div className="bg-secondary/60 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold">{botInfo.first_name}</p>
                <p className="text-[10px] text-muted-foreground">@{botInfo.username} · ID: {botInfo.id}</p>
              </div>
              <Badge className="ms-auto text-[9px] bg-green-400/10 text-green-400 border-0">Active</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Bot Username & Mini App URL */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-primary" /> Mini App Config
        </h3>
        <div>
          <label className="text-[10px] text-muted-foreground">Bot username (without @)</label>
          <Input
            value={botUsername}
            onChange={(e) => setBotUsername(e.target.value)}
            className="h-8 text-xs"
            placeholder="MyBot"
            data-testid="input-bot-username"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Mini App URL (the deployed app URL)</label>
          <div className="flex gap-1.5">
            <Input
              value={miniAppUrl}
              onChange={(e) => setMiniAppUrl(e.target.value)}
              className="h-8 text-xs flex-1"
              placeholder="https://your-app.replit.app"
              data-testid="input-mini-app-url"
            />
            {miniAppUrl && (
              <Button size="sm" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copy(miniAppUrl)}>
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        {botUsername && miniAppUrl && (
          <div className="bg-secondary/60 rounded-lg p-2 text-[10px] text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">Deep link for share:</p>
            <code className="break-all text-primary">
              https://t.me/{botUsername}?startapp=ref_USER_ID
            </code>
          </div>
        )}
      </div>

      {/* Webhook */}
      <div className="glass-card rounded-xl p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="w-4 h-4 text-blue-400" /> Webhook
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Point this at your Supabase <code className="text-primary">telegram-webhook</code> function URL,{" "}
          <span className="font-medium text-foreground">not</span> your Vercel domain. The Mini App URL above is what
          users open inside Telegram.
        </p>
        <div>
          <label className="text-[10px] text-muted-foreground">Webhook URL</label>
          <div className="flex gap-1.5">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="h-8 text-xs flex-1"
              placeholder="https://<project-ref>.supabase.co/functions/v1/telegram-webhook"
              data-testid="input-webhook-url"
            />
            {webhookUrl && (
              <Button size="sm" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copy(webhookUrl)}>
                <Copy className="w-3 h-3" />
              </Button>
            )}
          </div>
          {(() => {
            const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
            if (!supaUrl) return null;
            const suggested = `${supaUrl.replace(/\/$/, "")}/functions/v1/telegram-webhook`;
            if (webhookUrl === suggested) return null;
            return (
              <button
                type="button"
                onClick={() => setWebhookUrl(suggested)}
                className="mt-1 text-[10px] text-primary hover:underline"
                data-testid="button-use-supabase-url"
              >
                Use Supabase function URL → {suggested}
              </button>
            );
          })()}
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Secret Token (optional, for webhook validation)</label>
          <Input
            type="password"
            value={secretToken}
            onChange={(e) => setSecretToken(e.target.value)}
            className="h-8 text-xs"
            placeholder="Random string..."
            data-testid="input-webhook-secret"
          />
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={handleSetWebhook}
            disabled={loading === "set" || !token || !webhookUrl}
            className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700"
            data-testid="button-set-webhook"
          >
            {loading === "set" ? <Loader2 className="w-3 h-3 animate-spin me-1" /> : <Webhook className="w-3 h-3 me-1" />}
            Set Webhook
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGetWebhookInfo}
            disabled={loading === "whinfo" || !token}
            className="h-8 text-xs"
            data-testid="button-get-webhook-info"
          >
            {loading === "whinfo" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDeleteWebhook}
            disabled={loading === "del" || !token}
            className="h-8 text-xs text-destructive hover:text-destructive"
            data-testid="button-delete-webhook"
          >
            {loading === "del" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </Button>
        </div>

        {webhookInfo && (
          <div className="bg-secondary/60 rounded-lg p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              {webhookInfo.url
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                : <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              }
              <span className="text-[10px] font-medium">
                {webhookInfo.url ? "Webhook active" : "No webhook set"}
              </span>
            </div>
            {webhookInfo.url && (
              <p className="text-[9px] text-muted-foreground break-all">{webhookInfo.url}</p>
            )}
            {webhookInfo.pending_update_count > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Pending updates</span>
                <Badge className="text-[9px] bg-yellow-400/10 text-yellow-400 border-0">
                  {webhookInfo.pending_update_count}
                </Badge>
              </div>
            )}
            {webhookInfo.last_error_message && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-1.5">
                <p className="text-[9px] text-destructive">{webhookInfo.last_error_message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save All */}
      <Button onClick={handleSave} disabled={saving} className="w-full h-9 text-xs" data-testid="button-save-bot">
        {saving ? <Loader2 className="w-3 h-3 me-1 animate-spin" /> : <Save className="w-3 h-3 me-1" />}
        Save All Bot Settings
      </Button>
    </div>
  );
}
