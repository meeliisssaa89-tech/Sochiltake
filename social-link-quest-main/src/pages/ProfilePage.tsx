import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Languages, Wallet, ArrowDownToLine, ArrowUpRight, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Token {
  id: string;
  symbol: string;
  name: string;
  icon_url: string | null;
  price_usd: number;
}

export function ProfilePage() {
  const { t, language, setLanguage } = useLanguage();
  const { user, balances } = useUser();
  const { toast } = useToast();

  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ["wallet-tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("wallet_tokens").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  // Compute total USD: in-app balances (USDT 1:1, others by exchange_rate) + token holdings (price * 0 default)
  const totalUsd = balances.reduce((sum, b) => {
    if (!b.currencies) return sum;
    if (b.currencies.symbol === "USDT") return sum + Number(b.amount);
    return sum + Number(b.amount) * Number(b.currencies.exchange_rate || 0);
  }, 0);

  const walletAddress = `0x${(user?.telegram_id || "").padStart(40, "0").slice(-40)}`;
  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  const copyAddr = () => {
    navigator.clipboard.writeText(walletAddress);
    toast({ title: t("copied") });
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Language toggle on top */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Languages className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium">{t("language")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${language === "en" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>EN</span>
          <Switch checked={language === "ar"} onCheckedChange={(c) => setLanguage(c ? "ar" : "en")} />
          <span className={`text-xs ${language === "ar" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>AR</span>
        </div>
      </motion.div>

      {/* Wallet hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">{t("totalBalance")}</p>
              <p className="text-3xl font-bold tabular-nums mt-1">${totalUsd.toFixed(2)}</p>
              <button onClick={copyAddr} className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 hover:text-foreground transition-colors">
                <Wallet className="w-3 h-3" /> {shortAddr} <Copy className="w-2.5 h-2.5" />
              </button>
            </div>
            <Avatar className="h-12 w-12 border-2 border-primary/30">
              <AvatarImage src={user?.photo_url} />
              <AvatarFallback className="bg-secondary text-sm font-bold">{user?.first_name?.[0] || "U"}</AvatarFallback>
            </Avatar>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9">
              <ArrowDownToLine className="w-3.5 h-3.5 me-1" /> {t("deposit")}
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl h-9 border-primary/30">
              <ArrowUpRight className="w-3.5 h-3.5 me-1" /> {t("send")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* In-app balances */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="font-semibold text-sm mb-2 px-1">{t("appBalances")}</h3>
        <div className="space-y-1.5">
          {balances.map((b) => {
            if (!b.currencies) return null;
            const usdValue = b.currencies.symbol === "USDT" ? Number(b.amount) : Number(b.amount) * Number(b.currencies.exchange_rate || 0);
            return (
              <div key={b.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                  {b.currencies.symbol[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{b.currencies.name}</p>
                  <p className="text-[10px] text-muted-foreground">{b.currencies.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{Number(b.amount).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">${usdValue.toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* On-chain tokens (admin-managed) */}
      {tokens.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="font-semibold text-sm mb-2 px-1">{t("tokens")}</h3>
          <div className="space-y-1.5">
            {tokens.map((tk) => (
              <div key={tk.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                {tk.icon_url ? (
                  <img src={tk.icon_url} className="w-9 h-9 rounded-full" alt={tk.symbol} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">{tk.symbol[0]}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tk.name}</p>
                  <p className="text-[10px] text-muted-foreground">{tk.symbol} • ${Number(tk.price_usd).toFixed(4)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">0.00</p>
                  <p className="text-[10px] text-muted-foreground">$0.00</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
