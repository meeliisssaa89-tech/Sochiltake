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

const pages: Record<string, React.ComponentType> = {
  home: HomePage,
  tasks: TasksPage,
  leaderboard: LeaderboardPage,
  activity: ActivityPage,
  profile: ProfilePage,
};

export default function Index() {
  const [activeTab, setActiveTab] = useState("home");
  const { dir } = useLanguage();
  const { isLoading, user } = useUser();
  const { data: settings } = useAppSettings();
  const Page = pages[activeTab] || HomePage;

  // Telegram WebApp: expand to full size & request fullscreen (Bot API 8.0+)
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

  // Telegram-only access guard (after all hooks).
  const isInTelegram = typeof window !== "undefined" && !!(window as any).Telegram?.WebApp?.initData;
  const botUsername = (settings?.bot_username as string) || "";
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  if (!isLoading && !isInTelegram && !user && !isAdminRoute) {
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
        {hasLogo && (
          <div className="flex items-center justify-center pt-3 pb-1">
            <div className="relative w-14 h-14" data-testid="logo-frame">
              {/* Color-reflective glow behind the frame (uses the logo itself, blurred) */}
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
              {/* Glassy circular ring — thicker border */}
              <div
                className="absolute inset-0 rounded-full border-[3px] border-white/40 bg-white/8 backdrop-blur-md shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_6px_28px_rgba(255,255,255,0.12),inset_0_0_0_1px_rgba(255,255,255,0.15)] overflow-hidden"
              >
                {/* Subtle highlight sweep to make it look like glass */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" />
                {/* The actual crisp logo */}
                <img
                  src={logoUrl as string}
                  alt="App Logo"
                  className="absolute inset-0 m-auto w-[76%] h-[76%] object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
                  data-testid="img-app-logo"
                />
              </div>
            </div>
          </div>
        )}
        <main className="px-4 pt-4 pb-20">
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
