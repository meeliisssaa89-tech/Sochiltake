import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCurrencies } from "@/hooks/useSupabaseData";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "onboarding_v1_done";
const CURRENCY_KEY = "preferred_currency_id";

export function usePreferredCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || null;
}

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"currency" | "language">("currency");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>("");
  const { language, setLanguage } = useLanguage();
  const { data: currencies = [] } = useCurrencies();

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const activeCurrencies = (currencies as any[]).filter((c: any) => c.is_active);

  const handleCurrencyNext = () => {
    if (selectedCurrencyId) {
      localStorage.setItem(CURRENCY_KEY, selectedCurrencyId);
    }
    setStep("language");
  };

  const handleFinish = (lang: "en" | "ar") => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-8"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-3xl overflow-hidden border border-white/10"
            style={{ background: "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow accent */}
            <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 65%)" }} />

            <div className="relative p-6 space-y-5">
              {step === "currency" ? (
                <>
                  <div className="text-center space-y-1">
                    <div className="text-3xl mb-2">💰</div>
                    <h2 className="text-lg font-bold">Choose Your Currency</h2>
                    <p className="text-xs text-muted-foreground">Which currency do you want to earn and withdraw?</p>
                    <p className="text-xs text-muted-foreground" dir="rtl">ما العملة التي تريد كسبها والسحب بها؟</p>
                  </div>
                  <div className="space-y-2">
                    {activeCurrencies.map((c: any) => {
                      const selected = selectedCurrencyId === c.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCurrencyId(c.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            selected
                              ? "border-primary bg-primary/10 shadow-sm"
                              : "border-border/50 hover:border-primary/40"
                          }`}
                        >
                          {c.icon_url ? (
                            <img src={c.icon_url} alt={c.symbol} className="w-8 h-8 rounded-full object-contain shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold shrink-0">{c.symbol[0]}</div>
                          )}
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-semibold">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.symbol}</p>
                          </div>
                          {selected && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    className="w-full h-11 rounded-xl font-semibold"
                    onClick={handleCurrencyNext}
                    disabled={!selectedCurrencyId}
                  >
                    Continue →
                  </Button>
                  <button onClick={() => setStep("language")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Skip for now
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center space-y-1">
                    <div className="text-3xl mb-2">🌍</div>
                    <h2 className="text-lg font-bold">Choose Language / اختر اللغة</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { code: "en" as const, label: "English", emoji: "🇬🇧" },
                      { code: "ar" as const, label: "العربية", emoji: "🇸🇦" },
                    ].map(({ code, label, emoji }) => (
                      <button
                        key={code}
                        onClick={() => handleFinish(code)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:border-primary/60 hover:bg-primary/5 ${
                          language === code ? "border-primary bg-primary/10" : "border-border/50"
                        }`}
                      >
                        <span className="text-3xl">{emoji}</span>
                        <span className="text-sm font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { localStorage.setItem(STORAGE_KEY, "1"); setOpen(false); }} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Skip / تخطي
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
