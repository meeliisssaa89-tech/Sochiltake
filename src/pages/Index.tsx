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

  const pages: Record<string, React.ComponentType> = {
    home: HomePage,
    tasks: TasksPage,
    activity: ActivityPage,
    profile: ProfilePage,
  };

  function Web3LoadingScreen() {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute rounded-full"
            style={{ width: 130, height: 130, background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0.12, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{ width: 95, height: 95, background: "radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.65, 0.18, 0.65] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          <motion.div
            className="relative rounded-full flex items-center justify-center"
            style={{
              width: 74,
              height: 74,
              background: "radial-gradient(circle at 35% 30%, #a78bfa, #6366f1 50%, #4f46e5)",
              boxShadow: "0 0 32px 10px rgba(99,102,241,0.6), 0 0 60px 20px rgba(139,92,246,0.3)",
            }}
            animate={{
              boxShadow: [
                "0 0 32px 10px rgba(99,102,241,0.6), 0 0 60px 20px rgba(139,92,246,0.3)",
                "0 0 48px 18px rgba(99,102,241,0.9), 0 0 90px 32px rgba(139,92,246,0.5)",
                "0 0 32px 10px rgba(99,102,241,0.6), 0 0 60px 20px rgba(139,92,246,0.3)",
              ],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.32), transparent 58%)" }}
            />
            <motion.span
              className="relative z-10 text-white font-black text-2xl select-none"
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              ◈
            </motion.span>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <motion.h1
            className="text-2xl font-black tracking-widest"
            style={{
              background: "linear-gradient(135deg, #a78bfa 0%, #6366f1 40%, #06b6d4 100%)",
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
          <motion.div
            className="flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="rounded-full"
                style={{ width: 6, height: 6, background: "#6366f1" }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
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
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>
    );
  }
  