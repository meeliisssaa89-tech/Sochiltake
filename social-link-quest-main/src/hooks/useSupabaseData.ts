import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function invokeFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function useBalances(userId: string | undefined) {
  return useQuery({
    queryKey: ["balances", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("balances").select("*, currencies(*)").eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, currencies:reward_currency_id(symbol, name, icon_url)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAllTasks() {
  return useQuery({
    queryKey: ["all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, currencies:reward_currency_id(symbol, name, icon_url)")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUserTasks(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-tasks", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("user_tasks").select("*").eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useCheckinStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["checkin", userId],
    queryFn: async () => {
      if (!userId) return null;
      const today = new Date().toISOString().split("T")[0];
      const { data: todayCheckin } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", userId)
        .eq("check_in_date", today)
        .maybeSingle();
      const { data: lastCheckin } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", userId)
        .order("check_in_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { claimedToday: !!todayCheckin, streak: lastCheckin?.streak_count || 0, lastCheckin };
    },
    enabled: !!userId,
  });
}

export function useDailyCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => invokeFunction("daily-checkin", { userId }),
    onSuccess: (_d, userId) => {
      qc.invalidateQueries({ queryKey: ["checkin", userId] });
      qc.invalidateQueries({ queryKey: ["balances", userId] });
    },
  });
}

export function useVerifyTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, taskId, action }: { userId: string; taskId: string; action: string }) =>
      invokeFunction("verify-task", { userId, taskId, action }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["user-tasks", v.userId] });
      qc.invalidateQueries({ queryKey: ["balances", v.userId] });
    },
  });
}

export function useAdsToday(userId: string | undefined) {
  return useQuery({
    queryKey: ["ads-today", userId],
    queryFn: async () => {
      if (!userId) return [];
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ad_watches")
        .select("*")
        .eq("user_id", userId)
        .eq("watch_date", today)
        .order("slot_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useWatchAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, slotIndex }: { userId: string; slotIndex: number }) =>
      invokeFunction("watch-ad", { userId, slotIndex }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["ads-today", v.userId] });
      qc.invalidateQueries({ queryKey: ["balances", v.userId] });
    },
  });
}

export function useLeaderboard(type: "tasks" | "referrals") {
  return useQuery({
    queryKey: ["leaderboard", type],
    queryFn: async () => {
      if (type === "tasks") {
        const { data, error } = await supabase
          .from("user_tasks")
          .select("user_id, users(first_name, last_name, username, photo_url)")
          .eq("status", "completed");
        if (error) throw error;
        const counts: Record<string, { count: number; user: any }> = {};
        (data || []).forEach((ut: any) => {
          if (!counts[ut.user_id]) counts[ut.user_id] = { count: 0, user: ut.users };
          counts[ut.user_id].count++;
        });
        return Object.entries(counts)
          .map(([userId, { count, user }]) => ({
            userId,
            name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "User",
            username: user?.username,
            photo_url: user?.photo_url,
            score: count,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);
      } else {
        const { data, error } = await supabase
          .from("referrals")
          .select("inviter_id, users!referrals_inviter_id_fkey(first_name, last_name, username, photo_url)");
        if (error) throw error;
        const counts: Record<string, { count: number; user: any }> = {};
        (data || []).forEach((r: any) => {
          if (!counts[r.inviter_id]) counts[r.inviter_id] = { count: 0, user: r.users };
          counts[r.inviter_id].count++;
        });
        return Object.entries(counts)
          .map(([userId, { count, user }]) => ({
            userId,
            name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username || "User",
            username: user?.username,
            photo_url: user?.photo_url,
            score: count,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);
      }
    },
  });
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [usersRes, tasksRes, completedRes, adsRes] = await Promise.all([
        supabase.from("users").select("telegram_id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("user_tasks").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("ad_watches").select("id", { count: "exact", head: true }),
      ]);
      return {
        totalUsers: usersRes.count || 0,
        totalTasks: tasksRes.count || 0,
        totalCompleted: completedRes.count || 0,
        totalAdsWatched: adsRes.count || 0,
      };
    },
  });
}

export function useReferrals(userId: string | undefined) {
  return useQuery({
    queryKey: ["referrals", userId],
    queryFn: async () => {
      if (!userId) return { count: 0, referrals: [] };
      const { data, error, count } = await supabase
        .from("referrals")
        .select("*, users!referrals_invitee_id_fkey(first_name, last_name, username)", { count: "exact" })
        .eq("inviter_id", userId);
      if (error) throw error;
      return { count: count || 0, referrals: data || [] };
    },
    enabled: !!userId,
  });
}

export function useSocialLinks(userId: string | undefined) {
  return useQuery({
    queryKey: ["social-links", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("social_links").select("*").eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      const settings: Record<string, any> = {};
      (data || []).forEach((s: any) => {
        settings[s.key] = s.value;
      });
      return settings;
    },
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-settings"] }),
  });
}

export function useWithdrawals() {
  return useQuery({
    queryKey: ["withdrawals-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, users:user_id(first_name, last_name, username, telegram_id), currencies:currency_id(symbol, name, icon_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUserWithdrawals(userId: string | undefined) {
  return useQuery({
    queryKey: ["withdrawals-user", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, currencies:currency_id(symbol, name, icon_url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useCreateWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      currencyId,
      amount,
      walletAddress,
      balanceId,
    }: {
      userId: string;
      currencyId: string;
      amount: number;
      walletAddress: string;
      balanceId: string;
    }) => {
      // Deduct from balance first
      const { data: bal, error: balErr } = await supabase
        .from("balances")
        .select("amount")
        .eq("id", balanceId)
        .single();
      if (balErr) throw balErr;
      if (Number(bal.amount) < amount) throw new Error("Insufficient balance");

      const { error: deductErr } = await supabase
        .from("balances")
        .update({ amount: Number(bal.amount) - amount })
        .eq("id", balanceId);
      if (deductErr) throw deductErr;

      // Create withdrawal record
      const { error: wErr } = await supabase.from("withdrawals").insert({
        user_id: userId,
        currency_id: currencyId,
        amount,
        wallet_address: walletAddress,
        status: "pending",
      });
      if (wErr) throw wErr;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["withdrawals-user", v.userId] });
      qc.invalidateQueries({ queryKey: ["balances", v.userId] });
      qc.invalidateQueries({ queryKey: ["withdrawals-admin"] });
    },
  });
}

export function useApproveWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "approved", processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["withdrawals-admin"] }),
  });
}

export function useRejectWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId, currencyId, amount }: { id: string; userId: string; currencyId: string; amount: number }) => {
      // Refund balance
      const { data: bal, error: balErr } = await supabase
        .from("balances")
        .select("id, amount")
        .eq("user_id", userId)
        .eq("currency_id", currencyId)
        .maybeSingle();
      if (balErr) throw balErr;
      if (bal) {
        await supabase.from("balances").update({ amount: Number(bal.amount) + amount }).eq("id", bal.id);
      }

      const { error } = await supabase
        .from("withdrawals")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["withdrawals-admin"] }),
  });
}

export function useUpdateCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { icon_url?: string | null; name?: string; exchange_rate?: number } }) => {
      const { error } = await supabase.from("currencies").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["all-tasks"] });
    },
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ file }: { file: File; path: string }) => {
      return new Promise<string>((resolve, reject) => {
        if (file.size > 2 * 1024 * 1024) {
          reject(new Error("Image size must be less than 2 MB"));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    },
  });
}

export function useBroadcast() {
  return useMutation({
    mutationFn: async (payload: {
      message: string;
      parse_mode?: string;
      media_url?: string;
      media_type?: string;
      buttons?: { text: string; url: string }[];
    }) => invokeFunction("broadcast-message", payload),
  });
}

export function usePromoCodes() {
  return useQuery({
    queryKey: ["promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_codes" as any)
        .select("*, currencies:reward_currency_id(symbol, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreatePromoCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      code: string;
      reward_amount: number;
      reward_currency_id: string | null;
      xp_reward: number;
      max_uses: number;
      is_active: boolean;
      expires_at: string | null;
    }) => {
      const { error } = await supabase.from("promo_codes" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promo-codes"] }),
  });
}

export function useDeletePromoCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promo-codes"] }),
  });
}

export function useTogglePromoCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("promo_codes" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promo-codes"] }),
  });
}

export function useRedeemPromoCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, code }: { userId: string; code: string }) => {
      const { data: promo, error: promoErr } = await supabase
        .from("promo_codes" as any)
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (promoErr || !promo) throw new Error("Invalid or inactive promo code");

      const p = promo as any;
      if (p.expires_at && new Date(p.expires_at) < new Date()) throw new Error("Promo code has expired");
      if (p.max_uses > 0 && p.used_count >= p.max_uses) throw new Error("Promo code has reached its usage limit");

      const { data: existing } = await supabase
        .from("promo_redemptions" as any)
        .select("id")
        .eq("promo_id", p.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) throw new Error("You have already used this promo code");

      const { error: redErr } = await supabase.from("promo_redemptions" as any).insert({ promo_id: p.id, user_id: userId });
      if (redErr) throw new Error(redErr.message);

      await supabase.from("promo_codes" as any).update({ used_count: p.used_count + 1 }).eq("id", p.id);

      if (p.reward_amount > 0 && p.reward_currency_id) {
        const { data: bal } = await supabase.from("balances").select("id, amount").eq("user_id", userId).eq("currency_id", p.reward_currency_id).maybeSingle();
        if (bal) {
          await supabase.from("balances").update({ amount: Number(bal.amount) + p.reward_amount }).eq("id", bal.id);
        } else {
          await supabase.from("balances").insert({ user_id: userId, currency_id: p.reward_currency_id, amount: p.reward_amount });
        }
      }

      if (p.xp_reward > 0) {
        const { data: u } = await supabase.from("users").select("exp").eq("telegram_id", userId).maybeSingle();
        if (u) {
          const newExp = (u.exp || 0) + p.xp_reward;
          await supabase.from("users").update({ exp: newExp, level: Math.floor(newExp / 5000) + 1 }).eq("telegram_id", userId);
        }
      }

      return { reward: p.reward_amount, xp: p.xp_reward, message: `+${p.reward_amount} • +${p.xp_reward} XP` };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["balances", v.userId] });
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    },
  });
}
