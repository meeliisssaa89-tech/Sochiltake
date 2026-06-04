import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminAction } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, Eye, Camera, Mail, FileText, CreditCard, User, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Submission {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  started_at: string;
  metadata: any;
  tasks: { title_en: string; title_ar?: string; reward_amount: number; reward_currency_id: string; xp_reward: number; currencies?: { symbol: string } };
  users: { first_name?: string; username?: string; photo_url?: string; telegram_id: string };
}

export function AdminSubmissionsView() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [filter, setFilter] = useState<"pending" | "completed" | "rejected">("pending");

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["admin-submissions", filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_tasks")
        .select(`
          id, user_id, task_id, status, started_at, metadata,
          tasks!inner(title_en, title_ar, reward_amount, reward_currency_id, xp_reward, currencies:reward_currency_id(symbol)),
          users!user_tasks_user_id_fkey(first_name, username, photo_url, telegram_id)
        `)
        .eq("tasks.type", "submission")
        .eq("status", filter)
        .order("started_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Submission[];
    },
    staleTime: 30_000,
  });

  const approve = async (sub: Submission) => {
    if (!confirm(`Approve submission and credit ${sub.tasks.reward_amount} ${sub.tasks.currencies?.symbol || ""}?`)) return;
    setProcessing(sub.id);
    try {
      await supabase.from("user_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (sub.tasks.reward_amount > 0 && sub.tasks.reward_currency_id) {
        await adminAction("adjust_balance", {
          userId: sub.user_id,
          currencyId: sub.tasks.reward_currency_id,
          amount: sub.tasks.reward_amount,
          mode: "add",
        });
      }

      if (sub.tasks.xp_reward > 0) {
        const { data: ud } = await supabase.from("users").select("exp, level").eq("telegram_id", sub.user_id).single();
        if (ud) {
          const newExp = (ud.exp || 0) + sub.tasks.xp_reward;
          const newLevel = Math.floor(newExp / 5000) + 1;
          await supabase.from("users").update({ exp: newExp, level: newLevel }).eq("telegram_id", sub.user_id);
        }
      }

      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast({ title: "Approved", description: "Reward credited to user." });
      if (selected?.id === sub.id) setSelected(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (sub: Submission) => {
    if (!confirm("Reject this submission? User will need to resubmit.")) return;
    setProcessing(sub.id);
    try {
      await supabase.from("user_tasks")
        .update({ status: "rejected", metadata: { ...sub.metadata, rejected_at: new Date().toISOString() } })
        .eq("id", sub.id);
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast({ title: "Rejected" });
      if (selected?.id === sub.id) setSelected(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const subTypeIcon = (type: string) => {
    switch (type) {
      case "photo": return Camera;
      case "email": return Mail;
      case "id_document": return CreditCard;
      default: return FileText;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/40">
        {(["pending", "completed", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !submissions?.length ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No {filter} submissions
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => {
            const meta = sub.metadata || {};
            const SubIcon = subTypeIcon(meta.submission_type);
            const isProcessing = processing === sub.id;
            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  {sub.users?.photo_url ? (
                    <img src={sub.users.photo_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {sub.users?.first_name || sub.users?.username || sub.user_id}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{sub.tasks?.title_en}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-secondary/60 text-[10px] text-muted-foreground">
                      <SubIcon className="w-3 h-3" />
                      {meta.submission_type || "text"}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(sub.started_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {(meta.submission_url || meta.submission_text || meta.submission_email || meta.submission_password) && (
                  <div className="p-2 rounded-lg bg-secondary/40 space-y-1">
                    {meta.submission_url && (
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-muted-foreground">Attachment:</p>
                        <a
                          href={meta.submission_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                        >
                          View file <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                        {meta.submission_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                          <button onClick={() => setSelected(sub)} className="text-[10px] text-accent hover:underline">
                            Preview
                          </button>
                        )}
                      </div>
                    )}
                    {meta.submission_text && (
                      <p className="text-[11px] text-foreground/80 line-clamp-2">{meta.submission_text}</p>
                    )}
                    {meta.submission_email && (
                      <p className="text-[11px] text-foreground/80">{meta.submission_email}</p>
                    )}
                    {meta.submission_password && (
                      <div className="flex items-start gap-1.5">
                        <p className="text-[10px] text-muted-foreground shrink-0">Password:</p>
                        <code className="text-[10px] font-mono text-orange-400 break-all bg-orange-500/10 px-1.5 py-0.5 rounded">{meta.submission_password}</code>
                      </div>
                    )}
                  </div>
                )}

                {filter === "pending" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-[10px] rounded-lg bg-success/20 hover:bg-success/30 text-success border border-success/30"
                      variant="outline"
                      disabled={isProcessing}
                      onClick={() => approve(sub)}
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3 me-1" />Approve</>}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-[10px] rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
                      variant="outline"
                      disabled={isProcessing}
                      onClick={() => reject(sub)}
                    >
                      <XCircle className="w-3 h-3 me-1" />Reject
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-sm w-full rounded-2xl overflow-hidden bg-card border border-border"
            >
              {selected.metadata?.submission_url && (
                <img
                  src={selected.metadata.submission_url}
                  alt="Submission"
                  className="w-full max-h-80 object-contain"
                />
              )}
              <div className="p-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-lg" onClick={() => setSelected(null)}>Close</Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs rounded-lg bg-success/20 text-success border border-success/30 hover:bg-success/30"
                  variant="outline"
                  disabled={processing === selected.id}
                  onClick={() => approve(selected)}
                >
                  {processing === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
