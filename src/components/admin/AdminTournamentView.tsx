import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Trophy, Gamepad2, Users, Swords, Loader2,
  ChevronDown, ChevronUp, Send, Wallet, ArrowLeft, CheckCircle2, XCircle, Clock,
} from "lucide-react";

/* ─── tiny hooks ─────────────────────────────────────────────────────── */
function useAdminGames() {
  return useQuery({ queryKey: ["admin_tournament_games"], queryFn: async () => (await supabase.from("tournament_games").select("*").order("sort_order")).data || [] });
}
function useAdminTypes() {
  return useQuery({ queryKey: ["admin_tournament_types"], queryFn: async () => (await supabase.from("tournament_types").select("*").order("sort_order")).data || [] });
}
function useAdminTournaments() {
  return useQuery({
    queryKey: ["admin_tournaments_all"],
    queryFn: async () => (await supabase.from("tournaments").select("*, tournament_games(name), tournament_types(name)").order("created_at", { ascending: false })).data || [],
  });
}
function useTournamentParticipants(tournamentId: string | null) {
  return useQuery({
    queryKey: ["admin_tournament_participants", tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      const { data } = await supabase
        .from("tournament_player_entries")
        .select("user_id, player_game_id, joined_at, users:user_id(first_name, username, photo_url, telegram_id)")
        .eq("tournament_id", tournamentId)
        .order("joined_at");
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
  });
}

/* ─── Participants Panel ─────────────────────────────────────────────── */
function TournamentParticipants({ tournament, onBack }: { tournament: any; onBack: () => void }) {
  const { toast } = useToast();
  const { data: participants = [], isLoading } = useTournamentParticipants(tournament.id);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() || participants.length === 0) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("admin-action", {
        body: {
          action: "send_tournament_message",
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          message: message.trim(),
          user_ids: participants.map((p: any) => p.user_id),
        },
      });
      if (error) throw error;
      toast({ title: "Messages sent", description: `Sent to ${participants.length} participants` });
      setMessage("");
    } catch (e: any) {
      toast({ title: "Error sending messages", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-sm font-bold">{tournament.name}</p>
          <p className="text-xs text-muted-foreground">{participants.length} participants</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          className="h-9 text-sm flex-1"
          placeholder="Send message to all participants…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <Button size="sm" className="h-9 gap-1" onClick={sendMessage} disabled={sending || !message.trim()}>
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : participants.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No participants yet.</p>
      ) : (
        <div className="space-y-1.5">
          {participants.map((p: any) => (
            <div key={p.user_id} className="glass-card rounded-xl p-2.5 flex items-center gap-2">
              <Avatar className="w-7 h-7">
                <AvatarImage src={p.users?.photo_url} />
                <AvatarFallback className="text-[10px]">{(p.users?.first_name || "?")[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{p.users?.first_name || "Unknown"} {p.users?.username ? `@${p.users.username}` : ""}</p>
                <p className="text-[10px] text-muted-foreground">Game ID: {p.player_game_id || "—"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export function AdminTournamentView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: games = [] } = useAdminGames();
  const { data: types = [] } = useAdminTypes();
  const { data: tournaments = [] } = useAdminTournaments();
  const [viewingParticipants, setViewingParticipants] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<"tournaments" | "games" | "types" | "wallet">("tournaments");
  const [tLoading, setTLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [newGame, setNewGame] = useState({ name: "", icon_url: "", sort_order: "0" });
  const [newType, setNewType] = useState({ name: "", description: "", sort_order: "0" });
  const [newT, setNewT] = useState({
    name: "", game_id: "", type_id: "", mode: "solo",
    max_participants: "32", prize_pool: "0", entry_fee_usdt: "0",
    start_time: "", rules: "", player_id_label: "", terms: "",
  });

  const addGame = async () => {
    if (!newGame.name.trim()) return;
    const { error } = await supabase.from("tournament_games").insert({
      name: newGame.name.trim(), icon_url: newGame.icon_url.trim() || null, sort_order: Number(newGame.sort_order) || 0,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Game added" }); qc.invalidateQueries({ queryKey: ["admin_tournament_games"] }); setNewGame({ name: "", icon_url: "", sort_order: "0" }); }
  };

  const addType = async () => {
    if (!newType.name.trim()) return;
    const { error } = await supabase.from("tournament_types").insert({
      name: newType.name.trim(), description: newType.description.trim() || null, sort_order: Number(newType.sort_order) || 0,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Type added" }); qc.invalidateQueries({ queryKey: ["admin_tournament_types"] }); setNewType({ name: "", description: "", sort_order: "0" }); }
  };

  const addTournament = async () => {
    if (!newT.name.trim() || !newT.game_id) { toast({ title: "Name and game are required", variant: "destructive" }); return; }
    setTLoading(true);
    const { error } = await supabase.from("tournaments").insert({
      name: newT.name.trim(),
      game_id: newT.game_id,
      type_id: newT.type_id || null,
      mode: newT.mode,
      max_participants: Number(newT.max_participants) || 32,
      prize_pool: Number(newT.prize_pool) || 0,
      entry_fee_usdt: Number(newT.entry_fee_usdt) || 0,
      start_time: newT.start_time || null,
      rules: newT.rules.trim() || null,
      player_id_label: newT.player_id_label.trim() || null,
      terms: newT.terms.trim() || null,
      status: "upcoming",
    });
    setTLoading(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Tournament created" }); qc.invalidateQueries({ queryKey: ["admin_tournaments_all"] }); setNewT({ name: "", game_id: "", type_id: "", mode: "solo", max_participants: "32", prize_pool: "0", entry_fee_usdt: "0", start_time: "", rules: "", player_id_label: "", terms: "" }); }
  };

  const deleteTournament = async (id: string) => {
    if (!confirm("Delete this tournament?")) return;
    await supabase.from("tournaments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournaments_all"] });
  };

  const updateTournamentStatus = async (id: string, status: string) => {
    await supabase.from("tournaments").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournaments_all"] });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { upcoming: "bg-blue-500/10 text-blue-400", active: "bg-green-500/10 text-green-400", ended: "bg-muted/40 text-muted-foreground" };
    return <Badge className={`text-[9px] shrink-0 ${map[s] || ""}`}>{s}</Badge>;
  };

  const inp = "w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary/50";
  const sel = `${inp} cursor-pointer`;

  if (viewingParticipants) {
    return <TournamentParticipants tournament={viewingParticipants} onBack={() => setViewingParticipants(null)} />;
  }

  return (
    <div className="space-y-3">
      {/* Section tabs */}
      <div className="glass-card rounded-xl p-2">
        <div className="flex items-center gap-1 mb-2 px-1 pt-1">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          <h3 className="text-sm font-bold">Tournaments</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {([
            { id: "tournaments", label: "Tournaments", icon: Swords },
            { id: "games",       label: "Games",       icon: Gamepad2 },
            { id: "types",       label: "Types",       icon: Trophy },
            { id: "wallet",      label: "Wallet",      icon: Wallet },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                activeSection === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── GAMES ──────────────────────────────────────────────── */}
      {activeSection === "games" && (
        <div className="space-y-2">
          <div className="glass-card rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold">Add Game</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Game Name *</label><Input className="h-9 text-sm" placeholder="e.g. PUBG Mobile" value={newGame.name} onChange={(e) => setNewGame({ ...newGame, name: e.target.value })} /></div>
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Sort Order</label><Input className="h-9 text-sm" type="number" value={newGame.sort_order} onChange={(e) => setNewGame({ ...newGame, sort_order: e.target.value })} /></div>
            </div>
            <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Icon URL</label><Input className="h-9 text-sm" placeholder="https://…" value={newGame.icon_url} onChange={(e) => setNewGame({ ...newGame, icon_url: e.target.value })} /></div>
            <Button size="sm" className="w-full gap-2" onClick={addGame}><Plus className="w-3.5 h-3.5" /> Add Game</Button>
          </div>
          <div className="space-y-1.5">
            {(games as any[]).map((g) => (
              <div key={g.id} className="glass-card rounded-xl p-2.5 flex items-center gap-2">
                {g.icon_url && <img src={g.icon_url} alt={g.name} className="w-6 h-6 rounded" onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />}
                <p className="text-sm flex-1">{g.name}</p>
                <button onClick={() => { if (confirm("Delete game?")) { supabase.from("tournament_games").delete().eq("id", g.id).then(() => qc.invalidateQueries({ queryKey: ["admin_tournament_games"] })); } }} className="p-1 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TYPES ──────────────────────────────────────────────── */}
      {activeSection === "types" && (
        <div className="space-y-2">
          <div className="glass-card rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold">Add Type</p>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Type Name *</label><Input className="h-9 text-sm" placeholder="e.g. Solo" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} /></div>
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Sort Order</label><Input className="h-9 text-sm" type="number" value={newType.sort_order} onChange={(e) => setNewType({ ...newType, sort_order: e.target.value })} /></div>
            </div>
            <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Description</label><Input className="h-9 text-sm" placeholder="Optional" value={newType.description} onChange={(e) => setNewType({ ...newType, description: e.target.value })} /></div>
            <Button size="sm" className="w-full gap-2" onClick={addType}><Plus className="w-3.5 h-3.5" /> Add Type</Button>
          </div>
          <div className="space-y-1.5">
            {(types as any[]).map((t) => (
              <div key={t.id} className="glass-card rounded-xl p-2.5 flex items-center gap-2">
                <p className="text-sm flex-1">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                <button onClick={() => { if (confirm("Delete type?")) { supabase.from("tournament_types").delete().eq("id", t.id).then(() => qc.invalidateQueries({ queryKey: ["admin_tournament_types"] })); } }} className="p-1 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TOURNAMENTS ────────────────────────────────────────── */}
      {activeSection === "tournaments" && (
        <div className="space-y-2">
          <div className="glass-card rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold">New Tournament</p>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Tournament Name *</label>
              <Input className="h-9 text-sm" placeholder="e.g. Weekly PUBG Cup" value={newT.name} onChange={(e) => setNewT({ ...newT, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Game *</label>
                <select className={sel} value={newT.game_id} onChange={(e) => setNewT({ ...newT, game_id: e.target.value })}>
                  <option value="">Select…</option>
                  {(games as any[]).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Type</label>
                <select className={sel} value={newT.type_id} onChange={(e) => setNewT({ ...newT, type_id: e.target.value })}>
                  <option value="">None</option>
                  {(types as any[]).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Mode</label>
                <select className={sel} value={newT.mode} onChange={(e) => setNewT({ ...newT, mode: e.target.value })}>
                  <option value="solo">Solo</option>
                  <option value="duo">Duo</option>
                  <option value="squad">Squad</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Max Participants</label>
                <Input className="h-9 text-sm" type="number" value={newT.max_participants} onChange={(e) => setNewT({ ...newT, max_participants: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Prize Pool ($)</label>
                <Input className="h-9 text-sm" type="number" value={newT.prize_pool} onChange={(e) => setNewT({ ...newT, prize_pool: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Entry Fee ($)</label>
                <Input className="h-9 text-sm" type="number" value={newT.entry_fee_usdt} onChange={(e) => setNewT({ ...newT, entry_fee_usdt: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Start Time</label>
              <Input className="h-9 text-sm" type="datetime-local" value={newT.start_time} onChange={(e) => setNewT({ ...newT, start_time: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Rules</label>
              <textarea rows={2} className={`${inp} resize-none`} placeholder="Tournament rules…" value={newT.rules} onChange={(e) => setNewT({ ...newT, rules: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Player ID Label</label>
              <Input className="h-9 text-sm" placeholder="e.g. PUBG ID, IGN, UID…" value={newT.player_id_label} onChange={(e) => setNewT({ ...newT, player_id_label: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Terms & Conditions</label>
              <textarea rows={3} className={`${inp} resize-none`} placeholder="e.g. By joining you agree to fair play rules…" value={newT.terms} onChange={(e) => setNewT({ ...newT, terms: e.target.value })} />
            </div>
            <Button size="sm" className="w-full gap-2" onClick={addTournament} disabled={tLoading}>
              {tLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create Tournament
            </Button>
          </div>

          <div className="space-y-2">
            {(tournaments as any[]).map((t: any) => (
              <div key={t.id} className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.tournament_games?.name} · {t.tournament_types?.name || "No type"} · {t.mode}</p>
                    <p className="text-xs text-muted-foreground">💰 ${t.prize_pool} pool · 🎟️ ${t.entry_fee_usdt} entry · 👥 {t.current_participants}/{t.max_participants}</p>
                  </div>
                  {statusBadge(t.status)}
                </div>
                <div className="flex gap-1.5">
                  {["upcoming","active","ended"].map((s) => (
                    <button key={s} onClick={() => updateTournamentStatus(t.id, s)}
                      className={`flex-1 py-1 text-[10px] font-semibold rounded-lg capitalize transition-all ${t.status === s ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}>
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => setViewingParticipants(t)}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" /> Participants
                  </button>
                  <button onClick={() => deleteTournament(t.id)} className="p-1 rounded-lg text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {(tournaments as any[]).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tournaments yet.</p>}
          </div>
        </div>
      )}

      {/* ── WALLET SETTINGS ──────────────────────────────────────────── */}
      {activeSection === "wallet" && <TournamentWalletAdmin />}
    </div>
  );
}

/* ─── Default payment methods template ──────────────────────────────── */
const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: "usdt_trc20", name: "USDT TRC20", coin: "USDT", network: "TRC20", address: "", icon: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=040", enabled: true, type: "crypto" },
  { id: "ton",        name: "TON",        coin: "TON",  network: "TON",   address: "", icon: "https://cryptologos.cc/logos/toncoin-ton-logo.svg?v=040",   enabled: false, type: "crypto" },
  { id: "bnb",        name: "BNB (BSC)",  coin: "BNB",  network: "BSC",   address: "", icon: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=040",        enabled: false, type: "crypto" },
  { id: "eth",        name: "ETH ERC20",  coin: "ETH",  network: "ERC20", address: "", icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=040",   enabled: false, type: "crypto" },
];

interface PaymentMethod {
  id: string;
  name: string;
  coin: string;
  network: string;
  address: string;
  icon: string;
  enabled: boolean;
  type: "crypto" | "local";
  rate_usd?: number;
  instructions?: string;
}

/* ─── TournamentWalletAdmin ──────────────────────────────────────────── */
function TournamentWalletAdmin() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [walletTab, setWalletTab] = useState<"settings" | "deposits" | "withdrawals">("settings");

  // ── Load settings using key-value pattern (fixes the column error) ──
  const { data: raw, refetch } = useQuery({
    queryKey: ["admin_tournament_wallet"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value");
      const s: Record<string, any> = {};
      (data || []).forEach((row: any) => { s[row.key] = row.value; });
      return s;
    },
  });

  // ── Currencies for credit selection ──
  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await supabase.from("currencies").select("*")).data || [],
  });

  // ── Pending deposits ──
  const { data: deposits = [], refetch: refetchDeposits } = useQuery({
    queryKey: ["admin_tournament_deposits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_deposits")
        .select("*, users:user_id(first_name, username, telegram_id)")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    enabled: walletTab === "deposits",
  });

  // ── Tournament withdrawals ──
  const { data: tournWithdrawals = [], refetch: refetchTWithdrawals } = useQuery({
    queryKey: ["admin_tournament_withdrawals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_withdrawals")
        .select("*, users:user_id(first_name, username, telegram_id), currencies:currency_id(symbol, name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as any[];
    },
    enabled: walletTab === "withdrawals",
  });

  const [form, setForm] = useState({
    deposit_enabled: false,
    withdraw_enabled: false,
    min_deposit: "5",
    min_withdraw: "5",
    withdraw_note: "",
    exchange_rate: "1",
    deposit_credit_currency_id: "",
  });
  const [methods, setMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS.map((m) => ({ ...m })));
  const [formLoaded, setFormLoaded] = useState(false);

  useEffect(() => {
    if (raw && !formLoaded) {
      setForm({
        deposit_enabled:  raw.tournament_deposit_enabled  ?? false,
        withdraw_enabled: raw.tournament_withdraw_enabled ?? false,
        min_deposit:      String(raw.tournament_min_deposit  ?? 5),
        min_withdraw:     String(raw.tournament_min_withdraw ?? 5),
        withdraw_note:    raw.tournament_withdraw_note ?? "",
        exchange_rate:    String(raw.tournament_exchange_rate ?? 1),
        deposit_credit_currency_id: raw.tournament_deposit_credit_currency_id || "",
      });
      const savedMethods = raw.tournament_payment_methods;
      if (Array.isArray(savedMethods) && savedMethods.length > 0) {
        const merged = DEFAULT_PAYMENT_METHODS.map((def) => {
          const saved = savedMethods.find((m: any) => m.id === def.id);
          return saved ? { ...def, ...saved } : { ...def };
        });
        savedMethods.forEach((m: any) => {
          if (!merged.find((d) => d.id === m.id)) merged.push(m);
        });
        setMethods(merged as PaymentMethod[]);
      }
      setFormLoaded(true);
    }
  }, [raw, formLoaded]);

  const updateMethod = (id: string, field: string, value: any) => {
    setMethods((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  const addCryptoMethod = () => {
    const id = `custom_${Date.now()}`;
    setMethods((prev) => [...prev, { id, name: "Custom Coin", coin: "", network: "", address: "", icon: "", enabled: false, type: "crypto" }]);
  };

  const addLocalMethod = () => {
    const id = `local_${Date.now()}`;
    setMethods((prev) => [...prev, { id, name: "Local Currency", coin: "USD", network: "Bank Transfer", address: "", icon: "", enabled: false, type: "local", rate_usd: 1, instructions: "" }]);
  };

  const removeMethod = (id: string) => {
    setMethods((prev) => prev.filter((m) => m.id !== id));
  };

  // ── Save uses upsert with individual key-value rows (fixes column not found) ──
  const save = async () => {
    setSaving(true);
    const enabledMethod = methods.find((m) => m.enabled && m.type === "crypto");
    const upserts = [
      { key: "tournament_deposit_enabled",  value: form.deposit_enabled },
      { key: "tournament_withdraw_enabled", value: form.withdraw_enabled },
      { key: "tournament_min_deposit",      value: Number(form.min_deposit) || 5 },
      { key: "tournament_min_withdraw",     value: Number(form.min_withdraw) || 5 },
      { key: "tournament_withdraw_note",    value: form.withdraw_note.trim() || "" },
      { key: "tournament_exchange_rate",    value: Number(form.exchange_rate) || 1 },
      { key: "tournament_payment_methods",  value: methods },
      { key: "tournament_deposit_address",  value: enabledMethod?.address ?? "" },
      { key: "tournament_deposit_network",  value: enabledMethod?.network ?? "TRC20" },
      { key: "tournament_deposit_credit_currency_id", value: form.deposit_credit_currency_id || null },
    ];
    const { error } = await supabase
      .from("app_settings")
      .upsert(upserts, { onConflict: "key" });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Wallet settings saved ✓" }); setFormLoaded(false); refetch(); }
    setSaving(false);
  };

  const reviewDeposit = async (deposit: any, status: "approved" | "rejected", note?: string) => {
    // ── Credit balance when approving ──
    if (status === "approved" && deposit) {
      const creditCurrencyId = raw?.tournament_deposit_credit_currency_id || form.deposit_credit_currency_id || null;
      const amountUsd = Number(deposit.amount_usd || deposit.amount_local / (deposit.rate_usd || 1));
      if (creditCurrencyId && amountUsd > 0) {
        const { data: bal } = await supabase
          .from("balances")
          .select("amount")
          .eq("user_id", deposit.user_id)
          .eq("currency_id", creditCurrencyId)
          .maybeSingle();
        const newAmt = Number(bal?.amount || 0) + amountUsd;
        const { error: balErr } = await supabase
          .from("balances")
          .upsert({ user_id: deposit.user_id, currency_id: creditCurrencyId, amount: newAmt }, { onConflict: "user_id,currency_id" });
        if (balErr) {
          toast({ title: "Balance update failed", description: balErr.message, variant: "destructive" });
          return;
        }
      } else if (!creditCurrencyId) {
        toast({ title: "⚠️ No credit currency set", description: "Go to Wallet → Settings → Deposit Credit Currency", variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase
      .from("tournament_deposits")
      .update({ status, admin_note: note || null, reviewed_at: new Date().toISOString() })
      .eq("id", deposit.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: status === "approved" ? "Deposit approved ✓ — balance credited" : "Deposit rejected" });
      refetchDeposits();
    }
  };

  const reviewTWithdrawal = async (tw: any, status: "approved" | "rejected", note?: string) => {
    // ── Refund balance if rejecting ──
    if (status === "rejected" && tw.currency_id && tw.amount > 0) {
      const { data: bal } = await supabase
        .from("balances")
        .select("amount")
        .eq("user_id", tw.user_id)
        .eq("currency_id", tw.currency_id)
        .maybeSingle();
      const newAmt = Number(bal?.amount || 0) + Number(tw.amount);
      await supabase.from("balances").upsert(
        { user_id: tw.user_id, currency_id: tw.currency_id, amount: newAmt },
        { onConflict: "user_id,currency_id" }
      );
    }
    const { error } = await supabase
      .from("tournament_withdrawals")
      .update({ status, admin_note: note || null, reviewed_at: new Date().toISOString() })
      .eq("id", tw.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: status === "approved" ? "Withdrawal approved ✓" : "Withdrawal rejected — balance refunded" });
      refetchTWithdrawals();
    }
  };

  const inp = "w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary/50";

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="glass-card rounded-xl p-2 flex gap-1">
        {([
          { id: "settings",    label: "⚙️ Settings" },
          { id: "deposits",    label: "💰 Deposits" },
          { id: "withdrawals", label: "🏧 Withdrawals" },
        ] as const).map(({ id, label }) => (
          <button key={id} onClick={() => setWalletTab(id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${walletTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── SETTINGS TAB ─────────────────────────────── */}
      {walletTab === "settings" && (
        <>
          {/* On/Off toggles + basic settings */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Tournament Wallet Settings
            </h3>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-medium">Enable Deposits</p>
                <p className="text-xs text-muted-foreground">Players can submit deposits</p>
              </div>
              <Switch checked={form.deposit_enabled} onCheckedChange={(v) => setForm({ ...form, deposit_enabled: v })} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-medium">Enable Withdrawals</p>
                <p className="text-xs text-muted-foreground">Players can request withdrawals</p>
              </div>
              <Switch checked={form.withdraw_enabled} onCheckedChange={(v) => setForm({ ...form, withdraw_enabled: v })} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Min Deposit ($)</label>
                <input className={inp} type="number" min="0" value={form.min_deposit} onChange={(e) => setForm({ ...form, min_deposit: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Min Withdraw ($)</label>
                <input className={inp} type="number" min="0" value={form.min_withdraw} onChange={(e) => setForm({ ...form, min_withdraw: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Pts per $1</label>
                <input className={inp} type="number" min="0" step="1" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              "Pts per $1" = how many app points equal 1 USD (e.g. 100 = 100 pts/$). Shown as estimated value.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Withdrawal Note</label>
              <textarea rows={2} className={`${inp} resize-none`} placeholder="e.g. Withdrawals processed within 24h…" value={form.withdraw_note} onChange={(e) => setForm({ ...form, withdraw_note: e.target.value })} />
            </div>
          </div>

          {/* Payment methods */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Payment Methods</h3>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addCryptoMethod}>
                  <Plus className="w-3 h-3" /> Crypto
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addLocalMethod}>
                  <Plus className="w-3 h-3" /> Local
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Enable crypto or local currency methods. Players see a tab for each enabled method.</p>

            <div className="space-y-3">
              {methods.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {m.icon && <img src={m.icon} alt={m.coin} className="w-5 h-5 rounded-full" onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />}
                    <span className="text-sm font-semibold flex-1">{m.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${m.type === "local" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"}`}>
                      {m.type === "local" ? "LOCAL" : "CRYPTO"}
                    </span>
                    <Switch checked={m.enabled} onCheckedChange={(v) => updateMethod(m.id, "enabled", v)} />
                    {(m.id.startsWith("custom_") || m.id.startsWith("local_")) && (
                      <button onClick={() => removeMethod(m.id)} className="text-destructive p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {m.enabled && m.type === "crypto" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Display Name</label>
                          <input className={inp} value={m.name} onChange={(e) => updateMethod(m.id, "name", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Network</label>
                          <input className={inp} value={m.network} onChange={(e) => updateMethod(m.id, "network", e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Wallet Address</label>
                        <input className={inp} placeholder="Paste wallet address…" value={m.address} onChange={(e) => updateMethod(m.id, "address", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Icon URL (optional)</label>
                        <input className={inp} placeholder="https://…" value={m.icon} onChange={(e) => updateMethod(m.id, "icon", e.target.value)} />
                      </div>
                    </div>
                  )}

                  {m.type === "local" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Currency Name</label>
                          <input className={inp} placeholder="e.g. EGP, SAR, SDG" value={m.name} onChange={(e) => updateMethod(m.id, "name", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Currency Code</label>
                          <input className={inp} placeholder="e.g. EGP" value={m.coin} onChange={(e) => updateMethod(m.id, "coin", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Payment Method</label>
                          <input className={inp} placeholder="e.g. Bank Transfer, Vodafone Cash" value={m.network} onChange={(e) => updateMethod(m.id, "network", e.target.value)} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Rate (per $1 USD)</label>
                          <input className={inp} type="number" min="0" step="0.01" placeholder="e.g. 50" value={m.rate_usd ?? ""} onChange={(e) => updateMethod(m.id, "rate_usd", Number(e.target.value))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Account Number / Details</label>
                        <input className={inp} placeholder="Bank account, phone number, etc." value={m.address} onChange={(e) => updateMethod(m.id, "address", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Countdown minutes (shown to user after submit)</label>
                        <input className={inp} type="number" min="1" max="60" placeholder="e.g. 15" value={(m as any).countdown_minutes ?? 15} onChange={(e) => updateMethod(m.id, "countdown_minutes", Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Payment Instructions</label>
                        <textarea rows={2} className={`${inp} resize-none`} placeholder="Instructions for the player…" value={m.instructions ?? ""} onChange={(e) => updateMethod(m.id, "instructions", e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Deposit Credit Currency */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">💳 Deposit Credit Currency</h3>
            <p className="text-[10px] text-muted-foreground">
              عند الموافقة على طلب إيداع، سيُضاف مبلغ USD المعادل إلى هذه العملة في محفظة المستخدم.
            </p>
            <select
              className={inp}
              value={form.deposit_credit_currency_id}
              onChange={(e) => setForm({ ...form, deposit_credit_currency_id: e.target.value })}
            >
              <option value="">— اختر العملة —</option>
              {(currencies as any[]).map((cur: any) => (
                <option key={cur.id} value={cur.id}>{cur.symbol} — {cur.name}</option>
              ))}
            </select>
          </div>

          <Button size="sm" className="w-full gap-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save All Wallet Settings
          </Button>
        </>
      )}

      {/* ── WITHDRAWALS TAB ─────────────────────────────── */}
      {walletTab === "withdrawals" && (
        <div className="space-y-2">
          {(tournWithdrawals as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No withdrawal requests yet.</p>
          ) : (
            (tournWithdrawals as any[]).map((tw: any) => (
              <div key={tw.id} className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {tw.amount} {tw.currencies?.symbol || ""} • {tw.method_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tw.users?.first_name || "User"} {tw.users?.username ? `@${tw.users.username}` : ""}
                    </p>
                    {tw.wallet_address && <p className="text-[10px] text-muted-foreground font-mono break-all">{tw.wallet_address}</p>}
                    <p className="text-[10px] text-muted-foreground">{new Date(tw.created_at).toLocaleString()}</p>
                    {tw.admin_note && <p className="text-xs text-muted-foreground mt-1">Note: {tw.admin_note}</p>}
                  </div>
                  <span className={`text-[9px] px-2 py-1 rounded-full font-bold shrink-0 ${
                    tw.status === "approved" ? "bg-green-500/10 text-green-400" :
                    tw.status === "rejected" ? "bg-red-500/10 text-red-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {tw.status === "approved" ? "✓ Approved" : tw.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
                  </span>
                </div>
                {tw.status === "pending" && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => reviewTWithdrawal(tw, "approved")}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all">
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => { const note = prompt("Rejection reason:") || ""; reviewTWithdrawal(tw, "rejected", note); }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── DEPOSITS TAB ─────────────────────────────── */}
      {walletTab === "deposits" && (
        <div className="space-y-2">
          {(deposits as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No deposit requests yet.</p>
          ) : (
            (deposits as any[]).map((d: any) => (
              <div key={d.id} className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {d.amount_local} {d.currency} ≈ ${Number(d.amount_usd || d.amount_local / (d.rate_usd || 1)).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.users?.first_name || "User"} {d.users?.username ? `@${d.users.username}` : ""} · via {d.method_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                    {d.user_note && <p className="text-xs text-yellow-500 mt-1">Note: {d.user_note}</p>}
                    {d.admin_note && <p className="text-xs text-muted-foreground mt-1">Admin: {d.admin_note}</p>}
                  </div>
                  <span className={`text-[9px] px-2 py-1 rounded-full font-bold shrink-0 ${
                    d.status === "approved" ? "bg-green-500/10 text-green-400" :
                    d.status === "rejected" ? "bg-red-500/10 text-red-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {d.status === "approved" ? "✓ Approved" : d.status === "rejected" ? "✗ Rejected" : "⏳ Pending"}
                  </span>
                </div>
                {d.status === "pending" && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => reviewDeposit(d, "approved")}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all">
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => {
                        const note = prompt("Rejection reason (optional):") || "";
                        reviewDeposit(d, "rejected", note);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
