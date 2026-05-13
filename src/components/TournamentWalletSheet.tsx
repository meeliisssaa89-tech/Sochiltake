import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAppSettings } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, ArrowDownCircle, ArrowUpCircle, X, Clock, Send } from "lucide-react";
import { hapticImpact } from "@/lib/telegram";

const USDT_ICON = "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040";

interface PaymentMethod {
  id: string;
  name: string;
  coin: string;
  network: string;
  address: string;
  icon?: string;
  enabled: boolean;
  type?: "crypto" | "local";
  rate_usd?: number;
  instructions?: string;
}

export function TournamentWalletSheet({
  open,
  balance,
  userId,
  onClose,
}: {
  open: boolean;
  balance: number;
  userId?: string;
  onClose: () => void;
}) {
  const { data: settings } = useAppSettings();
  const [tab, setTab]                     = useState<"deposit" | "withdraw" | "history">("deposit");
  const [copiedId, setCopiedId]           = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [withdrawAddr, setWithdrawAddr]   = useState("");
  const [withdrawAmt, setWithdrawAmt]     = useState("");

  // Local currency deposit state
  const [localAmt,    setLocalAmt]    = useState("");
  const [localNote,   setLocalNote]   = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitErr,   setSubmitErr]   = useState<string | null>(null);

  const depositEnabled  = settings?.tournament_deposit_enabled  !== false;
  const withdrawEnabled = settings?.tournament_withdraw_enabled !== false;
  const minDeposit      = Number(settings?.tournament_min_deposit  ?? 5);
  const minWithdraw     = Number(settings?.tournament_min_withdraw ?? 5);
  const withdrawNote    = (settings?.tournament_withdraw_note as string) || "";
  const exchangeRate    = Number((settings as any)?.tournament_exchange_rate ?? 1);

  // All enabled payment methods (crypto + local)
  const rawMethods = (settings as any)?.tournament_payment_methods;
  const paymentMethods: PaymentMethod[] = Array.isArray(rawMethods) && rawMethods.length > 0
    ? rawMethods.filter((m: PaymentMethod) => m.enabled && (m.address || m.instructions))
    : (() => {
        const addr    = (settings?.tournament_deposit_address as string) || "";
        const network = (settings?.tournament_deposit_network as string) || "TRC20";
        if (!addr) return [];
        return [{ id: "usdt_trc20", name: `USDT ${network}`, coin: "USDT", network, address: addr, icon: USDT_ICON, enabled: true, type: "crypto" as const }];
      })();

  const activeMethodId = selectedMethodId || paymentMethods[0]?.id || null;
  const activeMethod   = paymentMethods.find((m) => m.id === activeMethodId) || paymentMethods[0] || null;

  const cryptoMethods = paymentMethods.filter((m) => (m.type ?? "crypto") === "crypto");
  const localMethods  = paymentMethods.filter((m) => m.type === "local");

  const copyText = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      hapticImpact("light");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const submitLocalDeposit = async () => {
    if (!activeMethod || !localAmt || !userId) return;
    const amt = Number(localAmt);
    if (isNaN(amt) || amt <= 0) { setSubmitErr("Enter a valid amount"); return; }
    setSubmitting(true); setSubmitErr(null);
    try {
      const rateUsd = activeMethod.rate_usd ?? 1;
      const amtUsd  = rateUsd > 0 ? amt / rateUsd : 0;
      const { error } = await supabase.from("tournament_deposits").insert({
        user_id:      userId,
        method_id:    activeMethod.id,
        method_name:  activeMethod.name,
        currency:     activeMethod.coin,
        amount_local: amt,
        rate_usd:     rateUsd,
        amount_usd:   amtUsd,
        user_note:    localNote.trim() || null,
        status:       "pending",
      });
      if (error) throw error;
      setSubmitted(true);
      hapticImpact("medium");
    } catch (e: any) {
      setSubmitErr(e.message);
    } finally { setSubmitting(false); }
  };

  const btnStyle = (active: boolean, color = "234,179,8") => ({
    background: active ? `rgba(${color},0.2)` : "transparent",
    border: `1px solid ${active ? `rgba(${color},0.4)` : "transparent"}`,
    color: active ? `rgb(${color})` : "rgba(255,255,255,0.4)",
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
            style={{
              background: "rgba(10,6,25,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div
              className="px-5 space-y-4 overflow-y-auto"
              style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 5.5rem)", maxHeight: "85vh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={USDT_ICON} className="w-6 h-6" alt="USDT" />
                  <div>
                    <h3 className="font-bold text-white text-base">Tournament Wallet</h3>
                    <p className="text-xs text-white/40">
                      Balance: <span className="text-white font-semibold">${balance.toFixed(2)}</span>
                      {exchangeRate > 1 && (
                        <span className="ms-1 text-white/30">≈ {(balance * exchangeRate).toFixed(0)} pts</span>
                      )}
                    </p>
                  </div>
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {([
                  { key: "deposit",  label: "Deposit",  icon: ArrowDownCircle },
                  { key: "withdraw", label: "Withdraw", icon: ArrowUpCircle },
                  { key: "history",  label: "History",  icon: Clock },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => { setTab(key); setSubmitted(false); setSubmitErr(null); }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={btnStyle(tab === key)}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* ── DEPOSIT TAB ─────────────────────────────────────────── */}
              {tab === "deposit" && (
                <div className="space-y-3">
                  {!depositEnabled ? (
                    <div className="py-10 text-center text-white/30 text-sm">Deposits currently disabled</div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="py-10 text-center text-white/30 text-sm">No deposit methods configured yet</div>
                  ) : (
                    <>
                      {/* Method tabs (show all enabled methods) */}
                      {paymentMethods.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {paymentMethods.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => { setSelectedMethodId(m.id); setSubmitted(false); setLocalAmt(""); setLocalNote(""); setSubmitErr(null); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all"
                              style={btnStyle(activeMethodId === m.id, m.type === "local" ? "34,197,94" : "234,179,8")}
                            >
                              {m.icon && (
                                <img src={m.icon} alt={m.coin} className="w-4 h-4 rounded-full"
                                  onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />
                              )}
                              {m.name}
                              {m.type === "local" && <span className="text-[9px] opacity-70">LOCAL</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* ── Crypto deposit ── */}
                      {activeMethod && (activeMethod.type ?? "crypto") === "crypto" && (
                        <div className="space-y-3">
                          <div className="text-center space-y-1">
                            <p className="text-xs text-white/40 font-semibold uppercase tracking-widest">
                              Send {activeMethod.coin} to this address
                            </p>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                              style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)", color: "rgb(234,179,8)" }}>
                              {activeMethod.icon && (
                                <img src={activeMethod.icon} alt={activeMethod.coin} className="w-3.5 h-3.5 rounded-full"
                                  onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />
                              )}
                              {activeMethod.network}
                            </div>
                          </div>

                          <div className="p-4 rounded-2xl space-y-3"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <p className="text-xs text-white/30 font-semibold uppercase tracking-wider">Wallet Address</p>
                            <p className="text-sm text-white font-mono break-all leading-relaxed select-all">{activeMethod.address}</p>
                            <button
                              onClick={() => copyText(activeMethod.address, activeMethod.id)}
                              className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                              style={{
                                background: copiedId === activeMethod.id ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                                border: `1px solid ${copiedId === activeMethod.id ? "rgba(34,197,94,0.35)" : "rgba(234,179,8,0.35)"}`,
                                color: copiedId === activeMethod.id ? "rgb(74,222,128)" : "rgb(234,179,8)",
                              }}>
                              {copiedId === activeMethod.id
                                ? <><Check className="w-4 h-4" /> Copied!</>
                                : <><Copy className="w-4 h-4" /> Copy Address</>}
                            </button>
                          </div>

                          <div className="p-3 rounded-xl"
                            style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)" }}>
                            <p className="text-[11px] text-white/50 text-center">
                              Minimum deposit: <strong className="text-white">${minDeposit} USDT</strong>
                              {" · "}Send only <strong className="text-white">{activeMethod.coin}</strong> on <strong className="text-white">{activeMethod.network}</strong> network
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Local currency deposit ── */}
                      {activeMethod && activeMethod.type === "local" && (
                        <div className="space-y-3">
                          {submitted ? (
                            <div className="py-8 text-center space-y-3">
                              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                                <Check className="w-7 h-7 text-green-400" />
                              </div>
                              <p className="text-sm font-bold text-white">Deposit Request Submitted</p>
                              <p className="text-xs text-white/40">
                                Your deposit request is pending review. It will be credited after admin approval.
                              </p>
                              <button
                                onClick={() => { setSubmitted(false); setLocalAmt(""); setLocalNote(""); }}
                                className="text-xs text-white/50 underline">
                                Submit another
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Payment details */}
                              <div className="p-4 rounded-2xl space-y-2"
                                style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
                                <p className="text-xs text-green-400 font-semibold uppercase tracking-wider">{activeMethod.network}</p>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-white font-mono break-all">{activeMethod.address}</p>
                                  <button onClick={() => copyText(activeMethod.address, activeMethod.id + "_local")}
                                    className="shrink-0 p-2 rounded-lg transition-all"
                                    style={{ background: copiedId === activeMethod.id + "_local" ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)" }}>
                                    {copiedId === activeMethod.id + "_local"
                                      ? <Check className="w-4 h-4 text-green-400" />
                                      : <Copy className="w-4 h-4 text-white/50" />}
                                  </button>
                                </div>
                                {activeMethod.rate_usd && activeMethod.rate_usd > 0 && (
                                  <p className="text-[11px] text-white/40">
                                    Rate: <strong className="text-white">1 USD = {activeMethod.rate_usd} {activeMethod.coin}</strong>
                                  </p>
                                )}
                                {activeMethod.instructions && (
                                  <p className="text-[11px] text-white/50 leading-relaxed pt-1 border-t border-white/5">
                                    {activeMethod.instructions}
                                  </p>
                                )}
                              </div>

                              {/* Submission form */}
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Submit Deposit Proof</p>
                                <div className="space-y-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={localAmt}
                                    onChange={(e) => setLocalAmt(e.target.value)}
                                    placeholder={`Amount in ${activeMethod.coin}…`}
                                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                                  />
                                  {localAmt && activeMethod.rate_usd && activeMethod.rate_usd > 0 && (
                                    <p className="text-xs text-green-400 px-1">
                                      ≈ ${(Number(localAmt) / activeMethod.rate_usd).toFixed(2)} USD
                                    </p>
                                  )}
                                  <textarea
                                    rows={2}
                                    value={localNote}
                                    onChange={(e) => setLocalNote(e.target.value)}
                                    placeholder="Transaction ID or note (optional)…"
                                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none resize-none transition-all"
                                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                                  />
                                </div>
                                {submitErr && <p className="text-xs text-red-400">{submitErr}</p>}
                                <button
                                  onClick={submitLocalDeposit}
                                  disabled={submitting || !localAmt || !userId}
                                  className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                  style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "rgb(74,222,128)" }}
                                >
                                  {submitting
                                    ? <><span className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />Submitting…</>
                                    : <><Send className="w-4 h-4" />Submit Deposit Request</>}
                                </button>
                                <p className="text-[10px] text-white/30 text-center">
                                  Your request will be reviewed and credited after admin approval.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── WITHDRAW TAB ─────────────────────────────────────────── */}
              {tab === "withdraw" && (
                <div className="space-y-3">
                  {!withdrawEnabled ? (
                    <div className="py-10 text-center text-white/30 text-sm">Withdrawals currently disabled</div>
                  ) : (
                    <>
                      {cryptoMethods.length > 1 && (
                        <div>
                          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">Network</p>
                          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                            {cryptoMethods.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => setSelectedMethodId(m.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all"
                                style={btnStyle(activeMethodId === m.id, "139,92,246")}
                              >
                                {m.icon && (
                                  <img src={m.icon} alt={m.coin} className="w-4 h-4 rounded-full"
                                    onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />
                                )}
                                {m.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                          Wallet Address {activeMethod ? `(${activeMethod.network})` : ""}
                        </label>
                        <input
                          value={withdrawAddr}
                          onChange={(e) => setWithdrawAddr(e.target.value)}
                          placeholder={`Enter your ${activeMethod?.coin || "crypto"} address…`}
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Amount (USDT)</label>
                        <input
                          value={withdrawAmt}
                          onChange={(e) => setWithdrawAmt(e.target.value)}
                          type="number"
                          min={minWithdraw}
                          placeholder={`Min: $${minWithdraw}`}
                          className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      </div>

                      {withdrawNote && (
                        <div className="p-3 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <p className="text-[11px] text-white/40 leading-relaxed">{withdrawNote}</p>
                        </div>
                      )}

                      <button
                        disabled={!withdrawAddr.trim() || Number(withdrawAmt) < minWithdraw || Number(withdrawAmt) > balance}
                        className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40"
                        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "rgb(167,139,250)" }}
                      >
                        Request Withdrawal
                      </button>
                      <p className="text-[10px] text-white/30 text-center">
                        Available: ${balance.toFixed(2)} · Min: ${minWithdraw}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* ── HISTORY TAB ─────────────────────────────────────────── */}
              {tab === "history" && (
                <DepositHistory userId={userId} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Deposit history for the current user ── */
function DepositHistory({ userId }: { userId?: string }) {
  const { data: deposits, isLoading } = useQuery({ queryKey: ["user_deposits", userId], queryFn: async () => {
    if (!userId) return [];
    const { data } = await supabase
      .from("tournament_deposits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data || []) as any[];
  }, enabled: !!userId });

  if (!userId) return <div className="py-10 text-center text-white/30 text-sm">Sign in to view history</div>;
  if (isLoading) return <div className="py-10 text-center text-white/30 text-sm">Loading…</div>;
  if (!deposits?.length) return <div className="py-10 text-center text-white/30 text-sm">No deposit history yet.</div>;

  return (
    <div className="space-y-2">
      {deposits.map((d: any) => (
        <div key={d.id} className="p-3 rounded-2xl space-y-1"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">
                {d.amount_local} {d.currency}
                {d.amount_usd && <span className="text-white/40 font-normal text-xs ms-1">≈ ${Number(d.amount_usd).toFixed(2)}</span>}
              </p>
              <p className="text-xs text-white/40">{d.method_name} · {new Date(d.created_at).toLocaleDateString()}</p>
              {d.admin_note && <p className="text-[11px] text-yellow-400/70 mt-0.5">{d.admin_note}</p>}
            </div>
            <span className={`text-[9px] px-2 py-1 rounded-full font-bold shrink-0 ${
              d.status === "approved" ? "bg-green-500/10 text-green-400" :
              d.status === "rejected" ? "bg-red-500/10 text-red-400" :
              "bg-yellow-500/10 text-yellow-400"
            }`}>
              {d.status === "approved" ? "✓ Approved" : d.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

