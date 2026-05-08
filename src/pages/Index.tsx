import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { AdsSdkInjector } from "@/components/AdsSdkInjector";
import { HomePage } from "@/pages/HomePage";
import { TasksPage } from "@/pages/TasksPage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { ActivityPage } from "@/pages/ActivityPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useAppSettings } from "@/hooks/useSupabaseData";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_PATH } from "@/lib/adminAuth";

const pages: Record<string, React.ComponentType> = {
  home: HomePage,
  tasks: TasksPage,
  leaderboard: LeaderboardPage,
  activity: ActivityPage,
  profile: ProfilePage,
};

export default function Index() {
  const [activeTab, setActiveTab] = useState("home");
  const { dir, language, setLanguage } = useLanguage();
  const { isLoading, user } = useUser();
  const { data: settings } = useAppSettings();
  const Page = pages[activeTab] || HomePage;

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
          <h1 className="text-xl font-bold">افتح التطبيق من تيليجرام</h1>
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-lg px-4">
          <Skeleton className="h-24 rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top" dir={dir}>
      <AdsSdkInjector />
      <div className="max-w-lg mx-auto">

        {/* ── Top bar: logo (center) + language toggle (end) ── */}
        <div className="relative flex items-center justify-center pt-3 pb-1 px-4 min-h-[52px]">
          {/* Logo — centered */}
          {hasLogo && (
            <div className="relative w-11 h-11" data-testid="logo-frame">
              <img
                src={logoUrl as string}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-contain rounded-full scale-125 blur-2xl opacity-70 pointer-events-none select-none"
              />
              <img
                src={logoUrl as string}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-contain rounded-full scale-110 blur-md opacity-60 pointer-events-none select-none"
              />
              <div className="absolute inset-0 rounded-full border-[2.5px] border-white/40 bg-white/8 backdrop-blur-md shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_6px_28px_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.15)] overflow-hidden">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
                <img
                  src={logoUrl as string}
                  alt="App Logo"
                  className="absolute inset-0 m-auto w-[76%] h-[76%] object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                  data-testid="img-app-logo"
                />
              </div>
            </div>
          )}

          {/* Language toggle pill — always at the end (right in LTR, left in RTL) */}
          <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            data-testid="button-lang-toggle"
            className="absolute end-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/15 bg-white/8 backdrop-blur-md text-[11px] font-semibold text-foreground/80 hover:bg-white/15 hover:text-foreground transition-all select-none"
            aria-label="Toggle language"
          >
            <motion.span
              key={language}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="text-primary"
            >
              {language === "en" ? "EN" : "AR"}
            </motion.span>
            <span className="text-muted-foreground/60">|</span>
            <span className="text-muted-foreground/70">
              {language === "en" ? "AR" : "EN"}
            </span>
          </button>
        </div>

        <main className="px-4 pt-3 pb-20">
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
