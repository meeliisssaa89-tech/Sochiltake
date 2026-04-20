import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  telegram_id: string;
  username: string;
  first_name: string;
  last_name: string;
  photo_url: string;
  level: number;
  exp: number;
  language: string;
  is_banned: boolean;
  created_at: string;
}

interface Balance {
  id: string;
  user_id: string;
  currency_id: string;
  amount: number;
  currencies: {
    id: string;
    symbol: string;
    name: string;
    icon_url: string | null;
    decimals: number;
    exchange_rate: number;
    is_active: boolean;
  } | null;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  isAdmin: boolean;
  balances: Balance[];
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);

  const callAuth = async (body: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const authenticateWithTelegram = async () => {
    const tgWebApp = (window as any).Telegram?.WebApp;
    const initData = tgWebApp?.initData;

    try {
      // Telegram WebApp setup (haptic, expand, theme)
      if (tgWebApp) {
        try {
          tgWebApp.ready();
          tgWebApp.expand();
          tgWebApp.enableClosingConfirmation?.();
          tgWebApp.setHeaderColor?.("secondary_bg_color");
        } catch {/* noop */}
      }

      let data;
      if (initData) {
        const startParam = tgWebApp.initDataUnsafe?.start_param || null;
        data = await callAuth({ initData, startParam });
      } else {
        data = await callAuth({ demo: true });
      }

      if (data?.user) {
        setUser(data.user);
        setBalances(data.balances || []);
        setIsAdmin(data.isAdmin || false);
      } else {
        console.error("Auth failed:", data);
      }
    } catch (err) {
      console.error("Auth error:", err);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    const { data } = await supabase.from("users").select("*").eq("telegram_id", user.telegram_id).maybeSingle();
    if (data) setUser(data as User);
    const { data: b } = await supabase
      .from("balances")
      .select("*, currencies(*)")
      .eq("user_id", user.telegram_id);
    if (b) setBalances(b as Balance[]);
  };

  useEffect(() => {
    authenticateWithTelegram().finally(() => setIsLoading(false));
  }, []);

  // Realtime: keep balances fresh whenever they change for this user
  useEffect(() => {
    if (!user?.telegram_id) return;
    const ch = supabase
      .channel(`balances-${user.telegram_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balances", filter: `user_id=eq.${user.telegram_id}` },
        () => {
          supabase
            .from("balances")
            .select("*, currencies(*)")
            .eq("user_id", user.telegram_id)
            .then(({ data }) => data && setBalances(data as Balance[]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.telegram_id]);

  return (
    <UserContext.Provider value={{ user, setUser, isLoading, isAdmin, balances, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
