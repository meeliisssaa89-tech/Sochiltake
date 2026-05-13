import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppSettings } from "@/hooks/useSupabaseData";
import { Copy, Check, ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";
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
}

export function TournamentWalletSheet({
  open,
  balance,
  onClose,
}: {
  open: boolean;
  balance: number;
  onClose: () => void;
}) {
  const { data: settings } = useAppSettings();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [withdrawAddr, setWithdrawAddr] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const depositEnabled  = settings?.tournament_deposit_enabled  !== false;
  const withdrawEnabled = settings?.tournament_withdraw_enabled !== false;
  const minDeposit      = Number(settings?.tournament_min_deposit  ?? 5);
  const minWithdraw     = Number(settings?.tournament_min_withdraw ?? 5);
  const withdrawNote    = (settings?.tournament_withdraw_note as string) || "";
  const exchangeRate    = Number((settings as any)?.tournament_exchange_rate ?? 1);

  // Multi-payment methods (new) with fallback to legacy single address
  const rawMethods = (settings as any)?.tournament_payment_methods;
  const paymentMethods: PaymentMethod[] = Array.isArray(rawMethods) && rawMethods.length > 0
    ? rawMethods.filter((m: PaymentMethod) => m.enabled && m.address)
    : (() => {
        const addr    = (settings?.tournament_deposit_address as string) || "";
        const network = (settings?.tournament_deposit_network as string) || "TRC20";
        if (!addr) return [];
        return [{ id: "usdt_trc20", name: `USDT ${network}`, coin: "USDT", network, address: addr, icon: USDT_ICON, enabled: true }];
      })();

  const activeMethodId = selectedMethodId || paymentMethods[0]?.id || null;
  const activeMethod   = paymentMethods.find((m) => m.id === activeMethodId) || paymentMethods[0] || null;

  const copyAddress = (addr: string, id: string) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
      setCopiedId(id);
      hapticImpact("light");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

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
              style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 5.5rem)", maxHeight: "80vh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={USDT_ICON} className="w-6 h-6" alt="USDT" />
                  <div>
                    <h3 className="font-bold text-white text-base">Tournament Wallet</h3>
                    <p className="text-xs text-white/40">
                      Balance: <span className="text-white font-semibold">${balance.toFixed(2)} USDT</span>
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

              {/* Deposit / Withdraw tabs */}
              <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {([
                  { key: "deposit",  label: "Deposit",  icon: ArrowDownCircle },
                  { key: "withdraw", label: "Withdraw", icon: ArrowUpCircle   },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: tab === key ? "rgba(234,179,8,0.2)" : "transparent",
                      border: tab === key ? "1px solid rgba(234,179,8,0.4)" : "1px solid transparent",
                      color: tab === key ? "rgb(234,179,8)" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              {/* ── DEPOSIT TAB ─────────────────────────────────────────── */}
              {tab === "deposit" && (
                <div className="space-y-3">
                  {!depositEnabled ? (
                    <div className="py-10 text-center text-white/30 text-sm">Deposits currently disabled</div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="py-10 text-center text-white/30 text-sm">No deposit address configured yet</div>
                  ) : (
                    <>
                      {/* Network selector (tabs when multiple methods) */}
                      {paymentMethods.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                          {paymentMethods.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setSelectedMethodId(m.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all"
                              style={{
                                background: activeMethodId === m.id ? "rgba(234,179,8,0.18)" : "rgba(255,255,255,0.05)",
                                border: `1px solid ${activeMethodId === m.id ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.08)"}`,
                                color: activeMethodId === m.id ? "rgb(234,179,8)" : "rgba(255,255,255,0.45)",
                              }}
                            >
                              {m.icon && (
                                <img src={m.icon} alt={m.coin} className="w-4 h-4 rounded-full"
                                  onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />
                              )}
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {activeMethod && (
                        <>
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
                            <p className="text-sm text-white font-mono break-all leading-relaxed">{activeMethod.address}</p>
                            <button
                              onClick={() => copyAddress(activeMethod.address, activeMethod.id)}
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
                        </>
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
                      {/* Network select for withdrawal */}
                      {paymentMethods.length > 1 && (
                        <div>
                          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5">Network</p>
                          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                            {paymentMethods.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => setSelectedMethodId(m.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all"
                                style={{
                                  background: activeMethodId === m.id ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.05)",
                                  border: `1px solid ${activeMethodId === m.id ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                                  color: activeMethodId === m.id ? "rgb(167,139,250)" : "rgba(255,255,255,0.45)",
                                }}
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
                        style={{
                          background: "rgba(139,92,246,0.2)",
                          border: "1px solid rgba(139,92,246,0.4)",
                          color: "rgb(167,139,250)",
                        }}
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
