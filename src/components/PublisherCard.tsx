import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink, Loader2, Link2, Eye, Globe, Wallet, Unlink, FileText,
} from "lucide-react";

interface PubStatus {
  publishers_enabled: boolean;
  payouts_enabled: boolean;
  signup_enabled: boolean;
  site_url: string | null;
  min_payout: number;
  payout_currency_id: string | null;
  revenue_per_visit: number;
}
interface PubArticle {
  id: string;
  slug: string;
  title: string;
  visit_count: number;
  earnings: number;
  status: string;
}
interface CountryRow { country: string; visits: number }
interface MeStats {
  linked: boolean;
  publisher?: {
    id: string;
    email: string;
    display_name?: string | null;
    pending_balance: number;
    lifetime_earnings: number;
    total_visits: number;
  };
  articles?: PubArticle[];
  countries?: CountryRow[];
}

async function callPub(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("shortlink-publisher", {
    body: { action, payload },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

function openExternal(url: string) {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url, { try_instant_view: false });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function PublisherCard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [status, setStatus] = useState<PubStatus | null>(null);
  const [stats, setStats] = useState<MeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // Load public status first; only load stats if a telegram user exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await callPub("status");
        if (cancelled) return;
        setStatus(s);
        if (s.publishers_enabled && user?.telegram_id) {
          const me = await callPub("me_stats", { telegram_id: String(user.telegram_id) });
          if (!cancelled) setStats(me);
        }
      } catch {
        // quietly hide if status call fails (program off / function not deployed)
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.telegram_id]);

  if (loading) return null;
  if (!status?.publishers_enabled) return null;

  const refreshStats = async () => {
    if (!user?.telegram_id) return;
    const me = await callPub("me_stats", { telegram_id: String(user.telegram_id) });
    setStats(me);
  };

  const onLink = async () => {
    if (!code.trim() || !user?.telegram_id) return;
    setLinking(true);
    try {
      await callPub("link_code", { telegram_id: String(user.telegram_id), code: code.trim() });
      toast({ title: "Linked!", description: "Publisher account connected." });
      setCode("");
      await refreshStats();
    } catch (e: any) {
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const onUnlink = async () => {
    if (!user?.telegram_id) return;
    if (!confirm("Disconnect this publisher account from your Telegram?")) return;
    setUnlinking(true);
    try {
      await callPub("unlink", { telegram_id: String(user.telegram_id) });
      setStats({ linked: false });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  };

  const onRequestPayout = async () => {
    if (!user?.telegram_id) return;
    setRequesting(true);
    try {
      const r = await callPub("request_payout", { telegram_id: String(user.telegram_id) });
      toast({
        title: "Payout requested",
        description: r?.message || "Admins will review shortly.",
      });
      await refreshStats();
    } catch (e: any) {
      toast({ title: "Payout failed", description: e.message, variant: "destructive" });
    } finally {
      setRequesting(false);
    }
  };

  const siteUrl = status.site_url || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card rounded-2xl p-4 border border-primary/20 space-y-3"
      data-testid="card-publisher"
    >
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm">Publisher Earnings</h3>
          <p className="text-[10px] text-muted-foreground">
            Earn from every visit to your articles
          </p>
        </div>
        {siteUrl && (
          <button
            onClick={() => openExternal(siteUrl)}
            className="text-[10px] text-primary flex items-center gap-1"
            data-testid="btn-open-shortlink-site"
          >
            Site <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {!stats?.linked ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {status.signup_enabled ? (
              <>
                Already a publisher? Paste your link-code below. Or{" "}
                {siteUrl && (
                  <button onClick={() => openExternal(`${siteUrl}/publisher/signup`)} className="text-primary underline">
                    create an account
                  </button>
                )}{" "}
                first.
              </>
            ) : (
              <>Paste your publisher link-code from the website to connect.</>
            )}
          </p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD-1234-WXYZ"
              maxLength={20}
              className="h-9 text-xs font-mono"
              data-testid="input-link-code"
            />
            <Button
              size="sm"
              onClick={onLink}
              disabled={linking || !code.trim()}
              className="h-9 rounded-xl"
              data-testid="btn-link-code"
            >
              {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Wallet className="w-3 h-3" />} label="Pending" value={Number(stats.publisher!.pending_balance).toFixed(4)} />
            <Stat icon={<Wallet className="w-3 h-3" />} label="Lifetime" value={Number(stats.publisher!.lifetime_earnings).toFixed(4)} />
            <Stat icon={<Eye className="w-3 h-3" />} label="Visits" value={String(stats.publisher!.total_visits)} />
          </div>

          {stats.articles && stats.articles.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Top articles
              </p>
              <div className="space-y-1">
                {stats.articles.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40"
                    data-testid={`article-row-${a.id}`}
                  >
                    <button
                      onClick={() => siteUrl && openExternal(`${siteUrl}/p/${a.slug}`)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-medium truncate">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.visit_count} visits · {Number(a.earnings).toFixed(4)} earned
                      </p>
                    </button>
                    <Badge className={`text-[9px] border-0 ${
                      a.status === "approved" ? "bg-success/20 text-success" :
                      a.status === "pending" ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                      "bg-destructive/20 text-destructive"
                    }`}>
                      {a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.countries && stats.countries.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Top countries
              </p>
              <div className="flex flex-wrap gap-1">
                {stats.countries.slice(0, 6).map((c) => (
                  <Badge
                    key={c.country}
                    variant="outline"
                    className="text-[10px] border-border"
                    data-testid={`country-${c.country}`}
                  >
                    {c.country}
                    <span className="ms-1 opacity-60">{c.visits}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {status.payouts_enabled && (
              <Button
                size="sm"
                onClick={onRequestPayout}
                disabled={
                  requesting ||
                  Number(stats.publisher!.pending_balance) < (status.min_payout || 0)
                }
                className="flex-1 h-9 rounded-xl bg-primary hover:bg-primary/90"
                data-testid="btn-request-payout"
              >
                {requesting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <>Withdraw to Telegram balance</>
                }
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onUnlink}
              disabled={unlinking}
              className="h-9 rounded-xl"
              data-testid="btn-unlink-publisher"
            >
              {unlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {status.payouts_enabled && Number(stats.publisher!.pending_balance) < (status.min_payout || 0) && (
            <p className="text-[10px] text-muted-foreground text-center">
              Minimum payout: {Number(status.min_payout).toFixed(4)}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-2 text-center">
      <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">{icon}{label}</div>
      <p className="font-bold text-xs tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
