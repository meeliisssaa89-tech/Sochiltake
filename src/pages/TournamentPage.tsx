import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { hapticImpact } from "@/lib/telegram";
import { Trophy, Plus, Users, Clock, Swords, ChevronRight } from "lucide-react";
import { TournamentSeatsView } from "@/components/TournamentSeatsView";
import { TournamentWalletSheet } from "@/components/TournamentWalletSheet";

const USDT_ICON = "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040";

/* ─── helpers ─────────────────────────────────────────────────────────── */
function useGames() {
  return useQuery({
    queryKey: ["tournament_games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournament_games").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });
}

function useTournamentTypes() {
  return useQuery({
    queryKey: ["tournament_types"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_types").select("*").eq("is_active", true).order("sort_order");
      return data || [];
    },
  });
}

function useTournaments(gameId: string | null, typeId: string | null) {
  return useQuery({
    queryKey: ["tournaments", gameId, typeId],
    queryFn: async () => {
      let q = supabase.from("tournaments")
        .select("*, tournament_games(name, image_url), tournament_types(name)")
        .order("created_at", { ascending: false });
      if (gameId) q = q.eq("game_id", gameId);
      if (typeId) q = q.eq("type_id", typeId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!gameId,
  });
}

function useTournamentBalance(userId: string | undefined) {
  return useQuery({
    queryKey: ["tournament_balance", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data } = await supabase.from("tournament_balances").select("amount").eq("user_id", userId).maybeSingle();
      return Number(data?.amount || 0);
    },
    enabled: !!userId,
  });
}

function useMyEntries(userId: string | undefined) {
  return useQuery({
    queryKey: ["my_tournament_entries", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase.from("tournament_entries").select("tournament_id").eq("user_id", userId);
      return (data || []).map((e: any) => e.tournament_id as string);
    },
    enabled: !!userId,
  });
}

/* ─── dominant color from image ────────────────────────────────────── */
function getDominantColor(imageUrl: string, cb: (hex: string) => void) {
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
  img.src = imageUrl;
}

/* ─── GameCard ────────────────────────────────────────────────────────── */
function GameCard({ game, onSelect }: { game: any; onSelect: () => void }) {
  const [rgb, setRgb] = useState("80,40,140");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => { hapticImpact("medium"); onSelect(); }}
      className="relative cursor-pointer overflow-hidden"
      style={{
        borderRadius: 20,
        background: `rgba(${rgb},0.12)`,
        border: `1.5px solid rgba(${rgb},0.35)`,
        boxShadow: `0 8px 40px rgba(${rgb},0.25), inset 0 1px 0 rgba(255,255,255,0.1)`,
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: "16/7" }}>
        {game.image_url ? (
          <>
            <div className="absolute inset-0 scale-110 blur-2xl opacity-40"
              style={{ background: `radial-gradient(ellipse, rgba(${rgb},0.8) 0%, transparent 70%)` }} />
            <img
              src={game.image_url} alt={game.name}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ borderRadius: "20px 20px 0 0" }}
              onLoad={() => getDominantColor(game.image_url, setRgb)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, rgba(${rgb},0.4), rgba(0,0,0,0.6))` }}>
            <Swords className="w-20 h-20 opacity-30" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 pt-12"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}>
          <h2 className="font-black leading-none tracking-tight select-none"
            style={{
              fontSize: "clamp(2.2rem, 8vw, 3.5rem)", color: "#fff",
              textShadow: `0 0 30px rgba(${rgb},0.9), 0 2px 8px rgba(0,0,0,0.8)`,
              letterSpacing: "-0.02em",
            }}>
            {game.name.toUpperCase()}
          </h2>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white/80 font-medium">Live</span>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: `rgb(${rgb})` }} />
          <span className="text-xs font-semibold text-white/70">Tournaments available</span>
        </div>
        <ChevronRight className="w-4 h-4 text-white/40" />
      </div>
    </motion.div>
  );
}

/* ─── TournamentCard ─────────────────────────────────────────────────── */
function TournamentCard({ t: trn, isJoined, onOpenSeats }: { t: any; isJoined: boolean; onOpenSeats: () => void }) {
  const [rgb, setRgb] = useState("139,92,246");
  const isClassic = trn.mode === "classic";
  const statusColors: Record<string, string> = {
    upcoming: "245,158,11", active: "34,197,94", ended: "100,116,139",
  };
  const sRgb = statusColors[trn.status] || "139,92,246";
  const imgSrc = trn.image_url || trn.tournament_games?.image_url;

  useEffect(() => {
    if (imgSrc) getDominantColor(imgSrc, setRgb);
  }, [imgSrc]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
      style={{ borderRadius: 16, border: `1.5px solid rgba(${rgb},0.3)`, background: `rgba(${rgb},0.07)`, boxShadow: `0 4px 24px rgba(${rgb},0.15)` }}
    >
      {imgSrc && (
        <div className="relative h-24 overflow-hidden">
          <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60"
            onLoad={() => getDominantColor(imgSrc, setRgb)} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 20%, rgba(8,8,20,0.95) 100%)` }} />
          <div className="absolute inset-0 rounded-t-2xl" style={{ boxShadow: `inset 0 0 30px rgba(${rgb},0.3)` }} />
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
            style={{ background: `rgba(${rgb},0.3)`, border: `1px solid rgba(${rgb},0.5)`, color: `rgb(${rgb})`, backdropFilter: "blur(8px)" }}>
            {isClassic ? "Classic" : "Warehouse"}
          </div>
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.55)", border: `1px solid rgba(${sRgb},0.5)`, backdropFilter: "blur(8px)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${sRgb})` }} />
            <span className="text-[10px] font-semibold capitalize" style={{ color: `rgb(${sRgb})` }}>{trn.status}</span>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-white leading-tight">{trn.name}</h3>
          {trn.tournament_types?.name && (
            <span className="text-xs font-medium mt-0.5 inline-block px-2 py-0.5 rounded-full"
              style={{ background: `rgba(${rgb},0.15)`, color: `rgb(${rgb})` }}>
              {trn.tournament_types.name}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <img src={USDT_ICON} className="w-3.5 h-3.5" alt="USDT" />, label: "Prize Pool", value: `$${Number(trn.prize_pool).toFixed(0)}` },
            { icon: <Users className="w-3.5 h-3.5" />, label: "Players", value: `${trn.current_participants}/${trn.max_participants}` },
            { icon: <Clock className="w-3.5 h-3.5" />, label: "Entry", value: `$${Number(trn.entry_fee_usdt).toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-2 text-center"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-center text-white/50 mb-0.5">{s.icon}</div>
              <p className="text-[10px] text-white/40">{s.label}</p>
              <p className="text-xs font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
        {trn.status !== "ended" && (
          <button
            onClick={(e) => { e.stopPropagation(); hapticImpact("medium"); onOpenSeats(); }}
            disabled={trn.current_participants >= trn.max_participants && !isJoined}
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: isJoined ? "rgba(34,197,94,0.15)" : `rgba(${rgb},0.25)`,
              border: `1px solid ${isJoined ? "rgba(34,197,94,0.4)" : `rgba(${rgb},0.5)`}`,
              color: isJoined ? "rgb(74,222,128)" : `rgb(${rgb})`,
              boxShadow: isJoined ? "none" : `0 0 12px rgba(${rgb},0.2)`,
            }}
          >
            {isJoined ? "✓ Joined · View Seats" : trn.current_participants >= trn.max_participants ? "Full" : "Join Tournament"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── GameTournamentsView ─────────────────────────────────────────────── */
function GameTournamentsView({
  game,
  onBack,
  onOpenSeats,
}: {
  game: any;
  onBack: () => void;
  onOpenSeats: (trn: any) => void;
}) {
  const { user } = useUser();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const { data: types = [] } = useTournamentTypes();
  const { data: tournaments = [], isLoading } = useTournaments(game.id, selectedTypeId);
  const { data: myEntries = [] } = useMyEntries(user?.telegram_id);

  const classicTournaments = tournaments.filter((t: any) => t.mode === "classic");
  const warehouseTournaments = tournaments.filter((t: any) => t.mode !== "classic");

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button onClick={() => setSelectedTypeId(null)}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: !selectedTypeId ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${!selectedTypeId ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
            color: !selectedTypeId ? "#a78bfa" : "rgba(255,255,255,0.5)", backdropFilter: "blur(12px)",
          }}>All</button>
        {types.map((tp: any) => (
          <button key={tp.id} onClick={() => setSelectedTypeId(selectedTypeId === tp.id ? null : tp.id)}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: selectedTypeId === tp.id ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${selectedTypeId === tp.id ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
              color: selectedTypeId === tp.id ? "#a78bfa" : "rgba(255,255,255,0.5)", backdropFilter: "blur(12px)",
            }}>{tp.name}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-52 rounded-2xl"/>)}</div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Trophy className="w-12 h-12 mx-auto text-white/20" />
          <p className="text-white/40 text-sm">No tournaments available yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {classicTournaments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 px-1">Classic</p>
              <div className="space-y-3">
                {classicTournaments.map((trn: any) => (
                  <TournamentCard key={trn.id} t={trn}
                    isJoined={myEntries.includes(trn.id)}
                    onOpenSeats={() => onOpenSeats(trn)} />
                ))}
              </div>
            </div>
          )}
          {warehouseTournaments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 px-1">Warehouse</p>
              <div className="space-y-3">
                {warehouseTournaments.map((trn: any) => (
                  <TournamentCard key={trn.id} t={trn}
                    isJoined={myEntries.includes(trn.id)}
                    onOpenSeats={() => onOpenSeats(trn)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ─── Main TournamentPage ─────────────────────────────────────────────── */
export function TournamentPage() {
  const { user, balances } = useUser();
  const { data: games = [], isLoading: gamesLoading } = useGames();
  const { data: tournamentBalance = 0, refetch: refetchBal } = useTournamentBalance(user?.telegram_id);
  const { data: myEntries = [] } = useMyEntries(user?.telegram_id);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [walletOpen, setWalletOpen] = useState(false);

  const usdtCurrency = balances.find((b: any) => b.currencies?.symbol === "USDT")?.currencies;
  const usdtIconUrl = usdtCurrency?.icon_url || USDT_ICON;

  const handleOpenSeats = (trn: any) => {
    hapticImpact("medium");
    setSelectedTournament(trn);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* ─── Header row: user pill | balance pill ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-2"
      >
        {/* User photo + name */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
          <Avatar className="h-7 w-7 border border-white/20">
            <AvatarImage src={user?.photo_url} />
            <AvatarFallback className="text-xs bg-primary/20 text-primary">
              {(user?.first_name || "U").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-bold text-white max-w-[80px] truncate">
            {user?.first_name || user?.username || "Player"}
          </span>
        </div>

        {/* Tournament balance + wallet button */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
          <img src={usdtIconUrl} alt="USDT" className="w-5 h-5 rounded-full object-contain" />
          <span className="text-sm font-bold text-white tabular-nums">
            {Number(tournamentBalance).toFixed(2)}
          </span>
          <button
            onClick={() => { hapticImpact("light"); setWalletOpen(true); }}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(139,92,246,0.35)", border: "1px solid rgba(139,92,246,0.5)" }}
          >
            <Plus className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </motion.div>

      {/* ─── content ──────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {selectedTournament ? (
          <motion.div key="seats-view">
            <TournamentSeatsView
              tournament={selectedTournament}
              balance={tournamentBalance}
              isAlreadyJoined={myEntries.includes(selectedTournament.id)}
              onBack={() => setSelectedTournament(null)}
              onJoinSuccess={() => { refetchBal(); }}
            />
          </motion.div>
        ) : selectedGame ? (
          <motion.div key="game-view">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setSelectedGame(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                ←
              </button>
              <h2 className="font-bold text-white">{selectedGame.name} Tournaments</h2>
            </div>
            <GameTournamentsView
              game={selectedGame}
              onBack={() => setSelectedGame(null)}
              onOpenSeats={handleOpenSeats}
            />
          </motion.div>
        ) : (
          <motion.div key="games-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <Swords className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Games</h2>
            </div>
            {gamesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-44 rounded-2xl" />
                <Skeleton className="h-44 rounded-2xl" />
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
                  <Swords className="w-8 h-8 text-primary/50" />
                </div>
                <p className="text-white/40 text-sm">No games available yet.</p>
                <p className="text-white/25 text-xs">Games are added by the admin.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {games.map((g: any) => (
                  <GameCard key={g.id} game={g} onSelect={() => setSelectedGame(g)} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* USDT Wallet Sheet */}
      <TournamentWalletSheet
        open={walletOpen}
        balance={tournamentBalance}
        userId={user?.telegram_id}
        onClose={() => setWalletOpen(false)}
      />
    </div>
  );
}
