import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Trophy, Gamepad2, Users, Swords, Upload, Loader2, ChevronDown, ChevronUp } from "lucide-react";

/* ─── tiny hooks ─────────────────────────────────────────────────────── */
function useAdminGames() {
  return useQuery({ queryKey: ["admin_tournament_games"], queryFn: async () => (await supabase.from("tournament_games").select("*").order("sort_order")).data || [] });
}
function useAdminTypes() {
  return useQuery({ queryKey: ["admin_tournament_types"], queryFn: async () => (await supabase.from("tournament_types").select("*").order("sort_order")).data || [] });
}
function useAdminTournaments() {
  return useQuery({ queryKey: ["admin_tournaments_all"], queryFn: async () => (await supabase.from("tournaments").select("*, tournament_games(name), tournament_types(name)").order("created_at", { ascending: false })).data || [] });
}

/* ─── main component ─────────────────────────────────────────────────── */
export function AdminTournamentView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<"games" | "types" | "tournaments" | "wallet">("games");

  const { data: games = [], isLoading: gamesLoading } = useAdminGames();
  const { data: types  = [] } = useAdminTypes();
  const { data: tournaments = [] } = useAdminTournaments();

  // ── New game form ──
  const [newGame, setNewGame] = useState({ name: "", image_url: "" });
  const [gameLoading, setGameLoading] = useState(false);

  const addGame = async () => {
    if (!newGame.name.trim()) return;
    setGameLoading(true);
    const { error } = await supabase.from("tournament_games").insert({ name: newGame.name.trim(), image_url: newGame.image_url.trim() || null, sort_order: games.length });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Game added" }); setNewGame({ name: "", image_url: "" }); qc.invalidateQueries({ queryKey: ["admin_tournament_games"] }); qc.invalidateQueries({ queryKey: ["tournament_games"] }); }
    setGameLoading(false);
  };

  const deleteGame = async (id: string) => {
    if (!confirm("Delete this game and all its tournaments?")) return;
    await supabase.from("tournament_games").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournament_games"] });
    qc.invalidateQueries({ queryKey: ["tournament_games"] });
    toast({ title: "Game deleted" });
  };

  const toggleGame = async (id: string, val: boolean) => {
    await supabase.from("tournament_games").update({ is_active: !val }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournament_games"] });
    qc.invalidateQueries({ queryKey: ["tournament_games"] });
  };

  // ── New type form ──
  const [newType, setNewType] = useState({ name: "" });
  const addType = async () => {
    if (!newType.name.trim()) return;
    const { error } = await supabase.from("tournament_types").insert({ name: newType.name.trim(), sort_order: types.length });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Type added" }); setNewType({ name: "" }); qc.invalidateQueries({ queryKey: ["admin_tournament_types"] }); qc.invalidateQueries({ queryKey: ["tournament_types"] }); }
  };
  const deleteType = async (id: string) => {
    await supabase.from("tournament_types").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournament_types"] });
  };

  // ── New tournament form ──
  const [newT, setNewT] = useState({
    name: "", game_id: "", type_id: "", mode: "classic",
    entry_fee_usdt: "0", prize_pool: "0", max_participants: "100",
    image_url: "", status: "upcoming",
    starts_at: "", ends_at: "",
    terms: "", player_id_label: "Player ID",
  });
  const [tLoading, setTLoading] = useState(false);

  const addTournament = async () => {
    if (!newT.name.trim() || !newT.game_id) { toast({ title: "Name and game are required", variant: "destructive" }); return; }
    setTLoading(true);
    const { error } = await supabase.from("tournaments").insert({
      name: newT.name.trim(),
      game_id: newT.game_id,
      type_id: newT.type_id || null,
      mode: newT.mode,
      entry_fee_usdt: Number(newT.entry_fee_usdt),
      prize_pool: Number(newT.prize_pool),
      max_participants: Number(newT.max_participants),
      image_url: newT.image_url.trim() || null,
      status: newT.status,
      starts_at: newT.starts_at || null,
      ends_at: newT.ends_at || null,
      terms: newT.terms.trim() || null,
      player_id_label: newT.player_id_label.trim() || "Player ID",
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Tournament created" });
      setNewT({ name: "", game_id: "", type_id: "", mode: "classic", entry_fee_usdt: "0", prize_pool: "0", max_participants: "100", image_url: "", status: "upcoming", starts_at: "", ends_at: "", terms: "", player_id_label: "Player ID" });
      qc.invalidateQueries({ queryKey: ["admin_tournaments_all"] });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    }
    setTLoading(false);
  };

  const deleteTournament = async (id: string) => {
    if (!confirm("Delete tournament?")) return;
    await supabase.from("tournaments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournaments_all"] });
    qc.invalidateQueries({ queryKey: ["tournaments"] });
    toast({ title: "Tournament deleted" });
  };

  const updateTournamentStatus = async (id: string, status: string) => {
    await supabase.from("tournaments").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_tournaments_all"] });
    qc.invalidateQueries({ queryKey: ["tournaments"] });
    toast({ title: `Status → ${status}` });
  };

  const sections: { key: "games" | "types" | "tournaments" | "wallet"; label: string; icon: any }[] = [
    { key: "games",       label: "Games",       icon: Gamepad2 },
    { key: "types",       label: "Types",       icon: Users },
    { key: "tournaments", label: "Tournaments", icon: Trophy },
    { key: "wallet",      label: "Wallet",      icon: Swords },
  ];

  const statusBadge = (s: string) => {
    if (s === "active")   return <Badge className="bg-green-500/20 text-green-400 text-[10px]">Active</Badge>;
    if (s === "upcoming") return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Upcoming</Badge>;
    return <Badge className="bg-slate-500/20 text-slate-400 text-[10px]">Ended</Badge>;
  };

  const inp = "w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary/50";
  const sel = "w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm";

  return (
    <div className="space-y-3">
      {/* Section tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeSection === s.key ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-3.5 h-3.5" />{s.label}
            </button>
          );
        })}
      </div>

      {/* ── GAMES ─────────────────────────────────────────────────────── */}
      {activeSection === "games" && (
        <div className="space-y-3">
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><Gamepad2 className="w-4 h-4 text-primary" /> Add Game</h3>
            <Input className="h-9 text-sm" placeholder="Game name (e.g. PUBG)" value={newGame.name} onChange={(e) => setNewGame({ ...newGame, name: e.target.value })} />
            <Input className="h-9 text-sm" placeholder="Cover image URL (https://…)" value={newGame.image_url} onChange={(e) => setNewGame({ ...newGame, image_url: e.target.value })} />
            {newGame.image_url && <img src={newGame.image_url} alt="" className="w-full h-28 object-cover rounded-xl" onError={(e) => { (e.currentTarget as any).style.display = "none"; }} />}
            <Button size="sm" className="w-full gap-2" onClick={addGame} disabled={gameLoading}>
              {gameLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add Game
            </Button>
          </div>

          {gamesLoading ? <div className="h-20 rounded-xl bg-muted/30 animate-pulse" /> : (
            <div className="space-y-2">
              {games.map((g: any) => (
                <div key={g.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                  {g.image_url && <img src={g.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.is_active ? "Active" : "Hidden"}</p>
                  </div>
                  <Switch checked={g.is_active} onCheckedChange={() => toggleGame(g.id, g.is_active)} />
                  <button onClick={() => deleteGame(g.id)} className="text-destructive hover:text-destructive/80 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {games.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No games yet. Add one above.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── TYPES ─────────────────────────────────────────────────────── */}
      {activeSection === "types" && (
        <div className="space-y-3">
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Tournament Types</h3>
            <p className="text-xs text-muted-foreground">These appear as filter tabs on the tournaments page (e.g. Single, Duo, Team).</p>
            <div className="flex gap-2">
              <Input className="h-9 text-sm flex-1" placeholder="Type name" value={newType.name} onChange={(e) => setNewType({ name: e.target.value })} />
              <Button size="sm" className="gap-1.5 h-9 px-4" onClick={addType}><Plus className="w-3.5 h-3.5" /> Add</Button>
            </div>
          </div>
          <div className="space-y-2">
            {types.map((tp: any) => (
              <div key={tp.id} className="glass-card rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm font-medium">{tp.name}</span>
                <button onClick={() => deleteType(tp.id)} className="text-destructive hover:text-destructive/80 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {types.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No types. Add Single, Duo, Team…</p>}
          </div>
        </div>
      )}

      {/* ── TOURNAMENTS ───────────────────────────────────────────────── */}
      {activeSection === "tournaments" && (
        <div className="space-y-3">
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Create Tournament</h3>
            <Input className="h-9 text-sm" placeholder="Tournament name" value={newT.name} onChange={(e) => setNewT({ ...newT, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className={sel} value={newT.game_id} onChange={(e) => setNewT({ ...newT, game_id: e.target.value })}>
                <option value="">Select Game *</option>
                {games.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select className={sel} value={newT.type_id} onChange={(e) => setNewT({ ...newT, type_id: e.target.value })}>
                <option value="">Type (optional)</option>
                {types.map((tp: any) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className={sel} value={newT.mode} onChange={(e) => setNewT({ ...newT, mode: e.target.value })}>
                <option value="classic">Classic</option>
                <option value="warehouse">Warehouse</option>
              </select>
              <select className={sel} value={newT.status} onChange={(e) => setNewT({ ...newT, status: e.target.value })}>
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Entry Fee (USDT)</label><Input className="h-9 text-sm" type="number" min="0" step="0.01" value={newT.entry_fee_usdt} onChange={(e) => setNewT({ ...newT, entry_fee_usdt: e.target.value })} /></div>
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Prize Pool ($)</label><Input className="h-9 text-sm" type="number" min="0" step="0.01" value={newT.prize_pool} onChange={(e) => setNewT({ ...newT, prize_pool: e.target.value })} /></div>
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Max Players</label><Input className="h-9 text-sm" type="number" min="2" value={newT.max_participants} onChange={(e) => setNewT({ ...newT, max_participants: e.target.value })} /></div>
            </div>
            <Input className="h-9 text-sm" placeholder="Custom image URL (optional — uses game image if empty)" value={newT.image_url} onChange={(e) => setNewT({ ...newT, image_url: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Start date (optional)</label><Input className="h-9 text-sm" type="datetime-local" value={newT.starts_at} onChange={(e) => setNewT({ ...newT, starts_at: e.target.value })} /></div>
              <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">End date (optional)</label><Input className="h-9 text-sm" type="datetime-local" value={newT.ends_at} onChange={(e) => setNewT({ ...newT, ends_at: e.target.value })} /></div>
            </div>
            <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Player ID Label (shown in join form)</label>
              <Input className="h-9 text-sm" placeholder="e.g. PUBG ID, IGN, UID…" value={newT.player_id_label} onChange={(e) => setNewT({ ...newT, player_id_label: e.target.value })} />
            </div>
            <div><label className="text-[10px] text-muted-foreground font-semibold block mb-1">Terms & Conditions (shown to player before joining)</label>
              <textarea rows={3} className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/50" placeholder="e.g. By joining you agree to fair play rules…" value={newT.terms} onChange={(e) => setNewT({ ...newT, terms: e.target.value })} />
            </div>
            <Button size="sm" className="w-full gap-2" onClick={addTournament} disabled={tLoading}>
              {tLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create Tournament
            </Button>
          </div>

          <div className="space-y-2">
            {tournaments.map((t: any) => (
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
                  <button onClick={() => deleteTournament(t.id)} className="p-1 rounded-lg text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {tournaments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No tournaments yet.</p>}
          </div>
        </div>
      )}

      {/* ── WALLET SETTINGS ──────────────────────────────────────────── */}
      {activeSection === "wallet" && <TournamentWalletAdmin />}
    </div>
  );
}

/* ─── TournamentWalletAdmin ──────────────────────────────────────────── */
function TournamentWalletAdmin() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const { data: raw, refetch } = useQuery({
    queryKey: ["admin_tournament_wallet"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("*").maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    deposit_enabled: false, withdraw_enabled: false,
    deposit_address: "", deposit_network: "TRC20",
    min_deposit: "5", min_withdraw: "5", withdraw_note: "",
  });
  const [formLoaded, setFormLoaded] = useState(false);

  useEffect(() => {
    if (raw && !formLoaded) {
      setForm({
        deposit_enabled: (raw as any).tournament_deposit_enabled ?? false,
        withdraw_enabled: (raw as any).tournament_withdraw_enabled ?? false,
        deposit_address: (raw as any).tournament_deposit_address ?? "",
        deposit_network: (raw as any).tournament_deposit_network ?? "TRC20",
        min_deposit: String((raw as any).tournament_min_deposit ?? 5),
        min_withdraw: String((raw as any).tournament_min_withdraw ?? 5),
        withdraw_note: (raw as any).tournament_withdraw_note ?? "",
      });
      setFormLoaded(true);
    }
  }, [raw, formLoaded]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({
      tournament_deposit_enabled: form.deposit_enabled,
      tournament_withdraw_enabled: form.withdraw_enabled,
      tournament_deposit_address: form.deposit_address.trim() || null,
      tournament_deposit_network: form.deposit_network.trim() || "TRC20",
      tournament_min_deposit: Number(form.min_deposit) || 5,
      tournament_min_withdraw: Number(form.min_withdraw) || 5,
      tournament_withdraw_note: form.withdraw_note.trim() || null,
    }).eq("id", raw?.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Wallet settings saved" }); refetch(); }
    setSaving(false);
  };

  const inp = "w-full rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary/50";

  return (
    <div className="space-y-3">
      <div className="glass-card rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Swords className="w-4 h-4 text-primary" /> Tournament USDT Wallet
        </h3>

        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
          <div>
            <p className="text-sm font-medium">Enable Deposits</p>
            <p className="text-xs text-muted-foreground">Allow players to deposit USDT</p>
          </div>
          <Switch checked={form.deposit_enabled} onCheckedChange={(v) => setForm({ ...form, deposit_enabled: v })} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
          <div>
            <p className="text-sm font-medium">Enable Withdrawals</p>
            <p className="text-xs text-muted-foreground">Allow players to withdraw USDT</p>
          </div>
          <Switch checked={form.withdraw_enabled} onCheckedChange={(v) => setForm({ ...form, withdraw_enabled: v })} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deposit Wallet Address</label>
          <input className={inp} placeholder="TRC20 / BEP20 address…" value={form.deposit_address} onChange={(e) => setForm({ ...form, deposit_address: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Network</label>
            <select className={inp} value={form.deposit_network} onChange={(e) => setForm({ ...form, deposit_network: e.target.value })}>
              <option>TRC20</option><option>BEP20</option><option>ERC20</option><option>Polygon</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Min Deposit ($)</label>
            <input className={inp} type="number" min="0" value={form.min_deposit} onChange={(e) => setForm({ ...form, min_deposit: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Min Withdrawal ($)</label>
          <input className={inp} type="number" min="0" value={form.min_withdraw} onChange={(e) => setForm({ ...form, min_withdraw: e.target.value })} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Withdrawal Note (shown to users)</label>
          <textarea rows={2} className={`${inp} resize-none`} placeholder="e.g. Withdrawals processed within 24h…" value={form.withdraw_note} onChange={(e) => setForm({ ...form, withdraw_note: e.target.value })} />
        </div>

        <Button size="sm" className="w-full gap-2" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save Wallet Settings
        </Button>
      </div>
    </div>
  );
}
