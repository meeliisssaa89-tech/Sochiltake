import { useState } from "react";
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
  const { isLoading } = useUser();
  const { data: settings } = useAppSettings();
  const Page = pages[activeTab] || HomePage;

  const logoUrl = settings?.app_logo_url;
  const hasLogo = logoUrl && typeof logoUrl === "string" && logoUrl !== "null" && logoUrl.trim() !== "";

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
    <div className="min-h-screen bg-background" dir={dir}>
      <AdsSdkInjector />
      <div className="max-w-lg mx-auto">
        {hasLogo && (
          <div className="flex items-center justify-center pt-3 pb-1">
            <img
              src={logoUrl as string}
              alt="App Logo"
              className="h-9 max-w-[140px] object-contain"
            />
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
