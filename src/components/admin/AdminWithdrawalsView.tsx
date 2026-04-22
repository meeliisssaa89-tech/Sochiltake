import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWithdrawals, useApproveWithdrawal, useRejectWithdrawal } from "@/hooks/useSupabaseData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Wallet } from "lucide-react";

export function AdminWithdrawalsView() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data: withdrawals, isLoading } = useWithdrawals();
  const approveMut = useApproveWithdrawal();
  const rejectMut = useRejectWithdrawal();
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const filtered = (withdrawals || []).filter(
    (w) => filterStatus === "all" || w.status === filterStatus
  );

  const handleApprove = async (id: string) => {
    try {
      await approveMut.mutateAsync(id);
      toast({ title: t("success"), description: t("withdrawApproved") });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (w: any) => {
    try {
      await rejectMut.mutateAsync({
        id: w.id,
        userId: w.user_id,
        currencyId: w.currency_id,
        amount: w.amount,
      });
      toast({ title: t("success"), description: t("withdrawRejected") });
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

  const pendingCount = (withdrawals || []).filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold">{t("withdrawManagement")}</h2>
        {pendingCount > 0 && (
          <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-0 text-[10px]">
            {pendingCount} {t("withdrawPending")}
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterStatus === s
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "الكل / All" : t(s === "pending" ? "withdrawPending" : s === "approved" ? "withdrawApproved" : "withdrawRejected")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">{t("noWithdrawals")}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w: any) => {
            const currency = w.currencies;
            const user = w.users;
            const userName = user?.first_name || user?.username || w.user_id;
            return (
              <div key={w.id} className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {currency?.icon_url ? (
                      <img src={currency.icon_url} alt={currency.symbol} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{currency?.symbol?.[0] || "?"}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {w.amount} {currency?.symbol || ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{userName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(w.status)}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {w.wallet_address && (
                  <div className="bg-secondary/50 rounded-lg px-2 py-1">
                    <p className="text-[10px] text-muted-foreground font-mono break-all">{w.wallet_address}</p>
                  </div>
                )}

                {w.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-success/10 text-success hover:bg-success/20 border-0"
                      disabled={approveMut.isPending || rejectMut.isPending}
                      onClick={() => handleApprove(w.id)}
                      data-testid={`btn-approve-${w.id}`}
                    >
                      <CheckCircle className="w-3 h-3 me-1" />
                      {t("withdrawApprove")}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 border-0"
                      disabled={approveMut.isPending || rejectMut.isPending}
                      onClick={() => handleReject(w)}
                      data-testid={`btn-reject-${w.id}`}
                    >
                      <XCircle className="w-3 h-3 me-1" />
                      {t("withdrawReject")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
