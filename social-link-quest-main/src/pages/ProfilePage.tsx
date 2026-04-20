import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useCreateWithdrawal, useUserWithdrawals } from "@/hooks/useSupabaseData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Languages, Wallet, ArrowUpRight, Copy, Loader2, X, ChevronDown } from "lucide-react";
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
  const createWithdrawal = useCreateWithdrawal();
  const { data: myWithdrawals } = useUserWithdrawals(user?.telegram_id);

  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [selectedBalanceId, setSelectedBalanceId] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const { data: tokens = [] } = useQuery<Token[]>({
    queryKey: ["wallet-tokens"],
    queryFn: async () => {
      const { data } = await supabase.from("wallet_tokens").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

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

  const selectedBalance = balances.find((b) => b.id === selectedBalanceId) || balances[0];

  const handleWithdraw = async () => {
    if (!user?.telegram_id || !selectedBalance) return;
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({ title: t("error"), description: t("enterAmount"), variant: "destructive" });
      return;
    }
    if (!withdrawAddress.trim()) {
      toast({ title: t("error"), description: t("enterAddress"), variant: "destructive" });
      return;
    }
    if (amount > Number(selectedBalance.amount)) {
      toast({ title: t("error"), description: t("insufficientBalance"), variant: "destructive" });
      return;
    }
    try {
      await createWithdrawal.mutateAsync({
        userId: user.telegram_id,
        currencyId: selectedBalance.currency_id,
        amount,
        walletAddress: withdrawAddress.trim(),
        balanceId: selectedBalance.id,
      });
      toast({ title: t("success"), description: t("withdrawPending") });
      setShowWithdrawForm(false);
      setWithdrawAmount("");
      setWithdrawAddress("");
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved")
      return <Badge className="bg-success/20 text-success border-0 text-[10px]">{t("withdrawApproved")}</Badge>;
    if (status === "rejected")
      return <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">{t("withdrawRejected")}</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-0 text-[10px]">{t("withdrawPending")}</Badge>;
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Language toggle */}
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
          <div className="mt-4">
            <Button
              size="sm"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9"
              onClick={() => setShowWithdrawForm(true)}
              data-testid="btn-open-withdraw"
            >
              <ArrowUpRight className="w-3.5 h-3.5 me-1" /> {t("withdrawRequest")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Withdraw form */}
      {showWithdrawForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-4 space-y-3 border border-primary/20"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{t("withdrawRequest")}</h3>
            <button onClick={() => setShowWithdrawForm(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Currency selector */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{t("withdrawCurrency")}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {balances.map((b) => {
                if (!b.currencies) return null;
                const cur = b.currencies as any;
                const isSelected = (selectedBalanceId || balances[0]?.id) === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBalanceId(b.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                      isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
                    }`}
                    data-testid={`btn-currency-${b.id}`}
                  >
                    {cur.icon_url ? (
                      <img src={cur.icon_url} alt={cur.symbol} className="w-4 h-4 rounded-full" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold">{cur.symbol[0]}</span>
                    )}
                    {cur.symbol}
                    <span className="text-[10px] opacity-70">({Number(b.amount).toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{t("withdrawAmount")}</p>
            <div className="relative">
              <Input
                type="number"
                placeholder={t("enterAmount")}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="bg-secondary border-border rounded-xl h-9 text-sm"
                data-testid="input-withdraw-amount"
              />
              {selectedBalance && (
                <button
                  onClick={() => setWithdrawAmount(String(Number(selectedBalance.amount)))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary"
                >
                  MAX
                </button>
              )}
            </div>
          </div>

          {/* Wallet address */}
          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{t("withdrawAddress")}</p>
            <Input
              placeholder={t("enterAddress")}
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="bg-secondary border-border rounded-xl h-9 text-sm font-mono"
              data-testid="input-withdraw-address"
            />
          </div>

          <Button
            className="w-full h-9 rounded-xl text-sm"
            onClick={handleWithdraw}
            disabled={createWithdrawal.isPending}
            data-testid="btn-submit-withdraw"
          >
            {createWithdrawal.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("withdrawSubmit")
            )}
          </Button>
        </motion.div>
      )}

      {/* In-app balances */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 className="font-semibold text-sm mb-2 px-1">{t("appBalances")}</h3>
        <div className="space-y-1.5">
          {balances.map((b) => {
            if (!b.currencies) return null;
            const cur = b.currencies as any;
            const usdValue = cur.symbol === "USDT" ? Number(b.amount) : Number(b.amount) * Number(cur.exchange_rate || 0);
            return (
              <div key={b.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                {cur.icon_url ? (
                  <img src={cur.icon_url} alt={cur.symbol} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
                    {cur.symbol[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{cur.name}</p>
                  <p className="text-[10px] text-muted-foreground">{cur.symbol}</p>
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

      {/* On-chain tokens */}
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

      {/* Withdrawal history */}
      {myWithdrawals && myWithdrawals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <button
            onClick={() => setShowHistory((p) => !p)}
            className="font-semibold text-sm mb-2 px-1 flex items-center gap-1 w-full"
          >
            {t("withdrawHistory")}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} />
            <Badge className="bg-secondary text-muted-foreground border-0 text-[10px] ms-1">{myWithdrawals.length}</Badge>
          </button>
          {showHistory && (
            <div className="space-y-1.5">
              {myWithdrawals.map((w: any) => {
                const cur = w.currencies;
                return (
                  <div key={w.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                    {cur?.icon_url ? (
                      <img src={cur.icon_url} alt={cur.symbol} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {cur?.symbol?.[0] || "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{w.amount} {cur?.symbol}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</p>
                    </div>
                    {statusBadge(w.status)}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
