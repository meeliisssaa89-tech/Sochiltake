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
  { id: "tournament", icon: Swords,     label: "Arena",        iconKey: "nav_arena",       isArena: true  },
  { id: "home",        icon: Home,       labelKey: "home",      iconKey: "nav_home",        isArena: false },
  { id: "tasks",       icon: ListChecks, labelKey: "tasks",     iconKey: "nav_tasks",       isArena: false },
  { id: "leaderboard", icon: Trophy,     labelKey: "leaderboard", iconKey: "nav_leaderboard", isArena: false },
  { id: "activity",    icon: Activity,   labelKey: "activity",  iconKey: "nav_activity",    isArena: false },
  { id: "profile",     icon: User,       labelKey: "profile",   iconKey: "nav_profile",     isArena: false },
] as const;

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useLanguage();
  const { data: settings } = useAppSettings();
  const icons = (settings?.app_icons || {}) as Record<string, string>;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none safe-bottom">
      <div className="max-w-lg mx-auto px-2 pb-3">
        <nav className="pointer-events-auto bottom-nav-glass rounded-2xl overflow-visible">
          <div className="flex items-center justify-around px-1 py-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const customIcon = icons[tab.iconKey];
              const isArena = tab.isArena;

              const activeBg = isArena
                ? { background: "rgba(234,179,8,0.18)", border: "1px solid rgba(234,179,8,0.35)" }
                : {};
              const activeColor = isActive
                ? isArena ? "rgb(234,179,8)" : undefined
                : undefined;

              return (
                <button
                  key={tab.id}
                  onClick={() => { hapticSelection(); onTabChange(tab.id); }}
                  className="relative flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-0 flex-1 transition-all"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabBg"
                      className={`absolute inset-0 rounded-xl ${isArena ? "" : "nav-active-glass"}`}
                      style={isArena ? activeBg : {}}
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center gap-0.5">
                    <AppIcon
                      src={customIcon}
                      fallback={tab.icon}
                      size={22}
                      className={`transition-colors ${
                        isActive
                          ? isArena
                            ? "drop-shadow-[0_0_6px_rgba(234,179,8,0.7)]"
                            : "text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.6)]"
                          : "text-muted-foreground"
                      }`}
                      style={activeColor ? { color: activeColor } : undefined}
                    />
                    <span
                      className={`text-[10px] font-medium transition-colors ${
                        isActive && !isArena ? "text-accent" : "text-muted-foreground"
                      }`}
                      style={activeColor ? { color: activeColor } : undefined}
                    >
                      {"label" in tab ? tab.label : t(tab.labelKey as any)}
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
  );
}
