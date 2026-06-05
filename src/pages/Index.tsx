import { useState, useEffect } from "react";
  import { AnimatePresence, motion } from "framer-motion";
  import { BottomNav } from "@/components/BottomNav";
  import { AdsSdkInjector } from "@/components/AdsSdkInjector";
  import { HomePage } from "@/pages/HomePage";
  import { TasksPage } from "@/pages/TasksPage";
  import { ActivityPage } from "@/pages/ActivityPage";
  import { ProfilePage } from "@/pages/ProfilePage";
  import { useLanguage } from "@/contexts/LanguageContext";
  import { useUser } from "@/contexts/UserContext";
  import { useAppSettings } from "@/hooks/useSupabaseData";
  import { ADMIN_PATH } from "@/lib/adminAuth";
import { OnboardingModal } from "@/components/OnboardingModal";

  const pages: Record<string, React.ComponentType> = {
    home: HomePage,
    tasks: TasksPage,
    activity: ActivityPage,
    profile: ProfilePage,
  };

  function Web3LoadingScreen() {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* Outer glow ring - blue/cyan */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 160, height: 160, background: "conic-gradient(from 0deg, rgba(0,82,255,0.25), rgba(0,195,255,0.3), rgba(0,232,163,0.2), rgba(0,82,255,0.25))" }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />
          {/* Middle ring - purple/pink */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 118, height: 118, background: "conic-gradient(from 180deg, rgba(139,92,246,0.35), rgba(236,72,153,0.3), rgba(249,115,22,0.2), rgba(139,92,246,0.35))" }}
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
          {/* Pulse ring */}
          <motion.div
            className="absolute rounded-full border"
            style={{ width: 96, height: 96, borderColor: "rgba(0,195,255,0.4)" }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0.15, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Core sphere */}
          <motion.div
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: 78,
              height: 78,
              background: "linear-gradient(135deg, #0052FF 0%, #00C3FF 40%, #00E8A3 80%, #6366F1 100%)",
              boxShadow: "0 0 28px 8px rgba(0,82,255,0.5), 0 0 60px 20px rgba(0,195,255,0.25), 0 0 0 2px rgba(255,255,255,0.12)",
            }}
            animate={{
              boxShadow: [
                "0 0 28px 8px rgba(0,82,255,0.5), 0 0 60px 20px rgba(0,195,255,0.25), 0 0 0 2px rgba(255,255,255,0.12)",
                "0 0 40px 16px rgba(0,82,255,0.7), 0 0 90px 32px rgba(0,232,163,0.35), 0 0 0 2px rgba(255,255,255,0.2)",
                "0 0 28px 8px rgba(0,82,255,0.5), 0 0 60px 20px rgba(0,195,255,0.25), 0 0 0 2px rgba(255,255,255,0.12)",
              ],
              scale: [1, 1.04, 1],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Glass highlight */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(ellipse at 35% 28%, rgba(255,255,255,0.38) 0%, transparent 60%)" }}
            />
            {/* Shine dot */}
            <div
              className="absolute"
              style={{ top: "12%", left: "18%", width: "26%", height: "20%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.65) 0%, transparent 70%)" }}
            />
            <motion.span
              className="relative z-10 text-white font-black text-2xl select-none"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              ◈
            </motion.span>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <motion.h1
            className="text-2xl font-black tracking-widest"
            style={{
              background: "linear-gradient(90deg, #0052FF 0%, #00C3FF 35%, #00E8A3 65%, #6366F1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            KYC P2P
          </motion.h1>
          {/* Animated loading bar */}
          <motion.div
            className="w-24 h-0.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #0052FF, #00C3FF, #00E8A3)" }}
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  export default function Index() {
    const [activeTab, setActiveTab] = useState("tasks");
    const { dir, language, setLanguage } = useLanguage();
    const { isLoading } = useUser();
    const { data: settings } = useAppSettings();
    const Page = pages[activeTab] || TasksPage;

    useEffect(() => {
      const w = (window as any).Telegram?.WebApp;
      if (!w) return;
      try { w.ready?.(); } catch { /* noop */ }
      try { w.expand?.(); } catch { /* noop */ }
      try { w.requestFullscreen?.(); } catch { /* noop */ }
      try { w.disableVerticalSwipes?.(); } catch { /* noop */ }
      try { w.setHeaderColor?.("#000000"); } catch { /* noop */ }
      try { w.setBackgroundColor?.("#000000"); } catch { /* noop */ }
    }, []);

    const logoUrl = settings?.app_logo_url;
    const hasLogo = logoUrl && typeof logoUrl === "string" && logoUrl !== "null" && logoUrl.trim() !== "";

    const isInTelegram = typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;
    const botUsername = (settings?.bot_username as string) || "";
    const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith(ADMIN_PATH);

    if (!isInTelegram && !isAdminRoute) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center" dir={dir}>
          <div className="space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center text-3xl">📱</div>
            <h1 className="text-xl font-bold">افتح التطبيق في تيليغرام</h1>
            <p className="text-sm text-muted-foreground">Open this Mini App inside Telegram to continue.</p>
            {botUsername && (
              <a
                href={`https://t.me/${botUsername}`}
                className="inline-block px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                data-testid="link-open-telegram"
              >
                Open in Telegram
              </a>
            )}
          </div>
        </div>
      );
    }

    if (isLoading) {
      return <Web3LoadingScreen />;
    }

    return (
      <div className="min-h-screen bg-background safe-top" dir={dir}>
        <AdsSdkInjector />
        <div className="max-w-lg mx-auto">
          <div className="relative flex items-center justify-center pt-3 pb-1 px-4 min-h-[52px]">
            {hasLogo && (
              <div className="relative w-11 h-11" data-testid="logo-frame">
                <img src={logoUrl as string} alt="" aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-contain rounded-full scale-125 blur-2xl opacity-70 pointer-events-none select-none" />
                <img src={logoUrl as string} alt="" aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-contain rounded-full scale-110 blur-md opacity-60 pointer-events-none select-none" />
                <div className="absolute inset-0 rounded-full border-[2.5px] border-white/40 bg-white/8 backdrop-blur-md shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_6px_28px_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.15)] overflow-hidden">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
                  <img src={logoUrl as string} alt="App Logo"
                    className="absolute inset-0 m-auto w-[76%] h-[76%] object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                    data-testid="img-app-logo" />
                </div>
              </div>
            )}
            <button
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              data-testid="button-lang-toggle"
              className="absolute end-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/15 bg-white/8 backdrop-blur-md text-[11px] font-semibold text-foreground/80 hover:bg-white/15 hover:text-foreground transition-all select-none"
              aria-label="Toggle language"
            >
              <motion.span key={language} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.15 }} className="text-primary">
                {language === "en" ? "EN" : "AR"}
              </motion.span>
              <span className="text-muted-foreground/60">|</span>
              <span className="text-muted-foreground/70">{language === "en" ? "AR" : "EN"}</span>
            </button>
          </div>

          <main className="px-4 pt-3 pb-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Page />
              </motion.div>
            </AnimatePresence>
          </main>
          <OnboardingModal />
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>
    );
  }
  