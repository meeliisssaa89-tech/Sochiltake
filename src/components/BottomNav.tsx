import { motion } from "framer-motion";
import { Home, ListChecks, Trophy, Activity, User, Swords } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppSettings } from "@/hooks/useSupabaseData";
import { AppIcon } from "@/components/AppIcon";
import { UpdateIndicator } from "@/components/UpdateIndicator";
import { hapticSelection } from "@/lib/telegram";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "home",        icon: Home,       labelKey: "home"        as const, iconKey: "nav_home" },
  { id: "tasks",       icon: ListChecks, labelKey: "tasks"       as const, iconKey: "nav_tasks" },
  { id: "leaderboard", icon: Trophy,     labelKey: "leaderboard" as const, iconKey: "nav_leaderboard" },
  { id: "activity",    icon: Activity,   labelKey: "activity"    as const, iconKey: "nav_activity" },
  { id: "profile",     icon: User,       labelKey: "profile"     as const, iconKey: "nav_profile" },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useLanguage();
  const { data: settings } = useAppSettings();
  const icons = (settings?.app_icons || {}) as Record<string, string>;

  const isTournament = activeTab === "tournament";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none safe-bottom">
      <div className="max-w-lg mx-auto px-3 pb-3">
        <div className="flex items-end gap-2">

          {/* ── Tournament bar (separate pill) ──────────────────────── */}
          <div className="pointer-events-auto flex-shrink-0">
            <div
              className="bottom-nav-glass rounded-2xl"
              style={{ width: 60 }}
            >
              <div className="px-1 py-2">
              <button
                onClick={() => { hapticSelection(); onTabChange("tournament"); }}
                className="relative flex flex-col items-center gap-0.5 py-1.5 px-1 w-full justify-center transition-all"
              >
                {isTournament && (
                  <motion.div
                    layoutId="tournamentActiveBg"
                    className="absolute inset-1 rounded-xl"
                    style={{ background: "rgba(234,179,8,0.2)", border: "1px solid rgba(234,179,8,0.35)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  <Swords
                    size={22}
                    strokeWidth={1.8}
                    className="transition-colors"
                    style={{ color: isTournament ? "rgb(234,179,8)" : "hsl(var(--muted-foreground))" }}
                  />
                  <span
                    className="text-[10px] font-medium transition-colors"
                    style={{ color: isTournament ? "rgb(234,179,8)" : "hsl(var(--muted-foreground))" }}
                  >
                    Arena
                  </span>
                </div>
              </button>
              </div>
            </div>
          </div>

          {/* ── Main nav bar ─────────────────────────────────────────── */}
          <nav className="pointer-events-auto flex-1 bottom-nav-glass rounded-2xl overflow-visible">
            <div className="flex items-center justify-around px-2 py-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const customIcon = icons[tab.iconKey];
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      hapticSelection();
                      onTabChange(tab.id);
                    }}
                    className="relative flex flex-col items-center gap-0.5 py-1.5 px-3 min-w-[48px] transition-all"
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabBg"
                        className="absolute inset-0 rounded-xl nav-active-glass"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-0.5">
                      <AppIcon
                        src={customIcon}
                        fallback={tab.icon}
                        size={22}
                        className={`transition-colors ${
                          isActive ? "text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.6)]" : "text-muted-foreground"
                        }`}
                      />
                      <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-accent" : "text-muted-foreground"}`}>
                        {t(tab.labelKey)}
                      </span>
                    </div>
                    {tab.id === "activity" && (
                      <span className="absolute -top-0.5 right-1 z-20">
                        <UpdateIndicator />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
