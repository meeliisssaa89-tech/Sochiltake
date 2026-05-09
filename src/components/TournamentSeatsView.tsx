import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact, hapticNotification } from "@/lib/telegram";
import { Eye, ShieldAlert, Info, ChevronLeft, Clock, Users, X } from "lucide-react";

/* ── countdown hook ─────────────────────────────────────────────────── */
function useCountdown(target: string | null) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setDiff(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, total: diff };
}

/* ── dominant color ─────────────────────────────────────────────────── */
function getDominantColor(url: string, cb: (rgb: string) => void) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    cb(`${r},${g},${b}`);
  };
  img.onerror = () => cb("139,92,246");
  img.src = url;
}

/* ── player entry fetcher (with user profile) ───────────────────────── */
function usePlayerEntries(tournamentId: string) {
  return useQuery({
    queryKey: ["player_entries", tournamentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_player_entries")
        .select("user_id, player_game_id, joined_at, users:user_id(first_name, username, photo_url)")
        .eq("tournament_id", tournamentId)
        .order("joined_at");
      return (data || []) as any[];
    },
    refetchInterval: 8000,
  });
}

function useMyPlayerEntry(tournamentId: string, userId: string | undefined) {
  return useQuery({
    queryKey: ["my_player_entry", tournamentId, userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("tournament_player_entries")
        .select("player_game_id")
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });
}

/* ── SeatCard ───────────────────────────────────────────────────────── */
const SEAT_SIZE = 72; // px — consistent across all grid sizes

function SeatCard({ entry, index, rgb }: { entry: any | null; index: number; rgb: string }) {
  if (entry) {
    const user = entry.users;
    const photoUrl = user?.photo_url;
    const fallback = (user?.first_name || entry.player_game_id || "?").slice(0, 2).toUpperCase();
    const displayName = (entry.player_game_id || user?.first_name || user?.username || "").slice(0, 8);

    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: Math.min(index * 0.015, 0.4) }}
        className="relative flex flex-col items-center justify-center rounded-xl gap-1 p-1"
        style={{
          width: SEAT_SIZE,
          height: SEAT_SIZE,
          background: `rgba(${rgb},0.12)`,
          border: `1px solid rgba(${rgb},0.35)`,
          boxShadow: `0 2px 12px rgba(${rgb},0.15)`,
          flexShrink: 0,
        }}
      >
        <Avatar className="w-10 h-10 border border-white/20">
          {photoUrl && <AvatarImage src={photoUrl} />}
          <AvatarFallback className="text-[11px] bg-primary/20 text-primary font-bold">
            {fallback}
          </AvatarFallback>
        </Avatar>
        <span className="text-[9px] text-white/50 truncate w-full text-center px-0.5">
          {displayName}
        </span>
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.008, 0.3) }}
      className="flex items-center justify-center rounded-xl"
      style={{
        width: SEAT_SIZE,
        height: SEAT_SIZE,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}
    >
      <span className="text-white/20 text-2xl font-thin">+</span>
    </motion.div>
  );
}

/* ── PlayerIdForm modal ─────────────────────────────────────────────── */
function PlayerIdForm({
  tournament,
  balance,
  onClose,
  onSubmit,
  loading,
}: {
  tournament: any;
  balance: number;
  onClose: () => void;
  onSubmit: (playerId: string) => void;
  loading: boolean;
}) {
  const [playerId, setPlayerId] = useState("");
  const canAfford = balance >= Number(tournament.entry_fee_usdt);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{
          background: "rgba(15,10,30,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderBottom: "none",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="px-5 pb-6 space-y-4" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom) + 6rem)" }}>
          {/* Monitoring warning */}
          <div className="flex items-start gap-3 p-3 rounded-2xl"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }}>
            <Eye className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "rgb(234,179,8)" }} />
            <div>
              <p className="text-xs font-bold" style={{ color: "rgb(234,179,8)" }}>Monitored Tournament</p>
              <p className="text-[11px] text-white/60 mt-0.5">
                This tournament is monitored. Any player found using cheats or hacks will be permanently disqualified and banned.
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            <h3 className="font-bold text-white text-lg">{tournament.name}</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Entry: <span className="text-white font-semibold">${Number(tournament.entry_fee_usdt).toFixed(2)} USDT</span>
              {!canAfford && <span className="text-red-400 ml-2">· Insufficient balance</span>}
            </p>
          </div>

          {/* Player ID input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              {tournament.player_id_label || "Player ID"}
            </label>
            <input
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              placeholder={`Enter your ${tournament.player_id_label || "Player ID"}...`}
              className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white placeholder-white/30 outline-none focus:border-yellow-500/50 transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>

          {/* Level 45 warning */}
          <div className="flex items-start gap-2 p-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
            <p className="text-[11px] text-red-300/80">
              Players with in-game account level below <strong className="text-red-300">45</strong> will be automatically excluded from the tournament.
            </p>
          </div>

          {/* Terms */}
          {tournament.terms && (
            <div className="flex items-start gap-2 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/40" />
              <p className="text-[11px] text-white/50 leading-relaxed">{tournament.terms}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={() => { if (playerId.trim() && canAfford) onSubmit(playerId.trim()); }}
            disabled={!playerId.trim() || !canAfford || loading}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40"
            style={{
              background: "rgba(234,179,8,0.25)",
              border: "1px solid rgba(234,179,8,0.5)",
              color: "rgb(234,179,8)",
              boxShadow: "0 0 20px rgba(234,179,8,0.15)",
            }}
          >
            {loading ? "Joining…" : canAfford ? "Confirm & Join Tournament" : "Insufficient Balance"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── CountdownSection ───────────────────────────────────────────────── */
function CountdownSection({ tournament, rgb }: { tournament: any; rgb: string }) {
  const { d, h, m, s, total } = useCountdown(tournament.starts_at);
  const isLive = tournament.status === "active";
  const ended = tournament.status === "ended";
  const imgSrc = tournament.image_url || tournament.tournament_games?.image_url;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        aspectRatio: "16/7",
        border: `1.5px solid rgba(${rgb},0.3)`,
        boxShadow: `0 8px 32px rgba(${rgb},0.2)`,
      }}
    >
      {imgSrc && (
        <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, rgba(0,0,0,0.85), rgba(${rgb},0.3))` }} />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
        {ended ? (
          <p className="text-white/60 font-bold text-lg">Tournament Ended</p>
        ) : isLive ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 font-black text-sm uppercase tracking-widest">Live Now</span>
            </div>
            <p className="text-white/50 text-xs">Tournament is in progress</p>
          </>
        ) : total > 0 ? (
          <>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Starts In
            </p>
            <div className="flex items-center gap-3">
              {[
                { v: d, l: "D" },
                { v: h, l: "H" },
                { v: m, l: "M" },
                { v: s, l: "S" },
              ].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center">
                  <span
                    className="font-black tabular-nums leading-none"
                    style={{
                      fontSize: "clamp(1.8rem, 7vw, 2.8rem)",
                      color: "rgb(234,179,8)",
                      textShadow: "0 0 20px rgba(234,179,8,0.7), 0 0 40px rgba(234,179,8,0.4)",
                    }}
                  >
                    {String(v).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-white/40 font-bold">{l}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-white/50 text-sm">No start time set</p>
        )}
      </div>
    </div>
  );
}

/* ── Main TournamentSeatsView ───────────────────────────────────────── */
export function TournamentSeatsView({
  tournament,
  balance,
  isAlreadyJoined,
  onBack,
  onJoinSuccess,
}: {
  tournament: any;
  balance: number;
  isAlreadyJoined: boolean;
  onBack: () => void;
  onJoinSuccess: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [rgb, setRgb] = useState("139,92,246");
  const [joinLoading, setJoinLoading] = useState(false);

  const imgSrc = tournament.image_url || tournament.tournament_games?.image_url;
  const { data: entries = [], refetch } = usePlayerEntries(tournament.id);
  const { data: myEntry } = useMyPlayerEntry(tournament.id, user?.telegram_id);

  useEffect(() => {
    if (imgSrc) getDominantColor(imgSrc, setRgb);
  }, [imgSrc]);

  const maxSeats = Number(tournament.max_participants) || 0;
  const seats = Array.from({ length: maxSeats }, (_, i) => entries[i] || null);

  /* always 4 columns, same seat size, horizontal scroll for big grids */
  const COLS = 4;
  const GAP = 8; // px
  const GRID_W = COLS * SEAT_SIZE + (COLS - 1) * GAP; // 72*4 + 3*8 = 312px

  const handleJoin = async (playerId: string) => {
    if (!user?.telegram_id) return;
    setJoinLoading(true);
    try {
      const entryFee = Number(tournament.entry_fee_usdt);
      if (balance < entryFee) throw new Error("Insufficient tournament balance");

      const newBal = balance - entryFee;
      const { error: balErr } = await supabase.from("tournament_balances")
        .upsert({ user_id: user.telegram_id, amount: newBal, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (balErr) throw new Error(balErr.message);

      const { error: entErr } = await supabase.from("tournament_entries")
        .insert({ tournament_id: tournament.id, user_id: user.telegram_id });
      if (entErr && !entErr.message.includes("duplicate")) throw new Error("Error joining tournament");

      await supabase.from("tournament_player_entries").upsert({
        tournament_id: tournament.id,
        user_id: user.telegram_id,
        player_game_id: playerId,
      }, { onConflict: "tournament_id,user_id" });

      await supabase.from("tournaments")
        .update({ current_participants: (tournament.current_participants || 0) + 1 })
        .eq("id", tournament.id);

      hapticNotification("success");
      toast({ title: "Joined!", description: "You're in. Good luck!" });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["my_tournament_entries"] });
      qc.invalidateQueries({ queryKey: ["tournament_balance"] });
      qc.invalidateQueries({ queryKey: ["player_entries", tournament.id] });
      setShowForm(false);
      refetch();
      onJoinSuccess();
    } catch (e: any) {
      hapticNotification("error");
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setJoinLoading(false);
    }
  };

  const isFull = entries.length >= maxSeats;
  const ended = tournament.status === "ended";
  const alreadyIn = isAlreadyJoined || !!myEntry;

  /* group seats into rows of COLS for the grid */
  const rows: (any | null)[][] = [];
  for (let i = 0; i < seats.length; i += COLS) {
    rows.push(seats.slice(i, i + COLS));
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        className="space-y-4"
        style={{ paddingBottom: "6rem" }}
      >
        {/* Back header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white truncate">{tournament.name}</h2>
            <p className="text-xs text-white/40">{entries.length}/{maxSeats} players joined</p>
          </div>
          {alreadyIn && (
            <div className="px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "rgb(74,222,128)" }}>
              ✓ Joined
            </div>
          )}
        </div>

        {/* Seats section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-white/30 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Seats
            </p>
            <p className="text-xs text-white/30">{maxSeats - entries.length} remaining</p>
          </div>

          {/* Scrollable seats container — always 4 cols, horizontal scroll when seats overflow */}
          <div
            className="rounded-2xl p-3 overflow-x-auto"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div style={{ minWidth: GRID_W, display: "flex", flexDirection: "column", gap: GAP }}>
              {rows.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: GAP }}>
                  {row.map((entry, ci) => (
                    <SeatCard
                      key={ri * COLS + ci}
                      entry={entry}
                      index={ri * COLS + ci}
                      rgb={rgb}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Join button */}
        {!ended && !alreadyIn && !isFull && (
          <button
            onClick={() => { hapticImpact("medium"); setShowForm(true); }}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
            style={{
              background: `rgba(${rgb},0.2)`,
              border: `1px solid rgba(${rgb},0.45)`,
              color: `rgb(${rgb})`,
              boxShadow: `0 0 20px rgba(${rgb},0.15)`,
            }}
          >
            Join Tournament — ${Number(tournament.entry_fee_usdt).toFixed(2)} USDT
          </button>
        )}

        {isFull && !alreadyIn && (
          <div className="w-full py-3.5 rounded-2xl text-sm font-bold text-center text-white/40"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            Tournament Full
          </div>
        )}

        {/* Countdown / Live section */}
        <CountdownSection tournament={tournament} rgb={rgb} />
      </motion.div>

      <AnimatePresence>
        {showForm && (
          <PlayerIdForm
            tournament={tournament}
            balance={balance}
            onClose={() => setShowForm(false)}
            onSubmit={handleJoin}
            loading={joinLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
}
