import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminAction } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Loader2, Eye, Camera, Mail, FileText, CreditCard, User, ExternalLink, Image as ImageIcon } from "lucide-react";
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
    if (!confirm(`Approve this submission and credit ${sub.tasks.reward_amount} ${sub.tasks.currencies?.symbol || ""}?`)) return;
    setProcessing(sub.id);
    try {
      // Use service-role edge function to update status (bypasses RLS)
      await adminAction("approve_submission", {
        userTaskId: sub.id,
        userId: sub.user_id,
        currencyId: sub.tasks.reward_currency_id,
        rewardAmount: sub.tasks.reward_amount,
        xpReward: sub.tasks.xp_reward,
      });
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast({ title: "✅ Approved", description: "Reward credited to user." });
      if (selected?.id === sub.id) setSelected(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (sub: Submission) => {
    if (!confirm("Reject this submission? The user will need to resubmit.")) return;
    setProcessing(sub.id);
    try {
      await adminAction("reject_submission", {
        userTaskId: sub.id,
      });
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
      case "photo": case "screenshot": return Camera;
      case "email": return Mail;
      case "id_document": return CreditCard;
      default: return FileText;
    }
  };

  /** Render user-submitted fields (structured submission_fields array or flat keys) */
  const renderSubmissionData = (meta: any) => {
    const items: { label: string; value: string; isImage?: boolean; isSecret?: boolean }[] = [];

    // Structured fields (new format: array of {type, label, value})
    if (Array.isArray(meta?.submission_fields)) {
      for (const f of meta.submission_fields) {
        if (!f?.value) continue;
        const isImage = f.type === "photo" || f.type === "screenshot" || String(f.value).match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
        const isSecret = f.type === "password";
        items.push({ label: f.label || f.type || "Field", value: String(f.value), isImage: !!isImage, isSecret });
      }
    }

    // Flat legacy fields
    if (meta?.submission_email) items.push({ label: "Email", value: meta.submission_email });
    if (meta?.submission_password) items.push({ label: "Password", value: meta.submission_password, isSecret: true });
    if (meta?.submission_text) items.push({ label: "Note", value: meta.submission_text });
    if (meta?.submission_url) {
      const isImage = String(meta.submission_url).match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
      items.push({ label: "Attachment", value: meta.submission_url, isImage: !!isImage });
    }

    if (items.length === 0) return null;

    return (
      <div className="p-2 rounded-lg bg-secondary/40 space-y-1.5">
        {items.map((item, i) => (
          <div key={i}>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
            {item.isImage ? (
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => setSelected({ ...selected! })}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                >
                  <ImageIcon className="w-3 h-3" />
                  View image
                </button>
                <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground flex items-center gap-0.5 hover:underline">
                  <ExternalLink className="w-2.5 h-2.5" /> Open
                </a>
              </div>
            ) : item.isSecret ? (
              <code className="text-[10px] font-mono text-orange-400 break-all bg-orange-500/10 px-1.5 py-0.5 rounded block mt-0.5">{item.value}</code>
            ) : (
              <p className="text-[11px] text-foreground/80 break-all mt-0.5">{item.value}</p>
            )}
          </div>
        ))}
      </div>
    );
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
            {f === "pending" && submissions && filter === "pending" && submissions.length > 0 && (
              <span className="ms-1 bg-destructive text-destructive-foreground text-[9px] px-1.5 rounded-full">{submissions.length}</span>
            )}
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
            const submType = meta.submission_type || "text";
            const SubIcon = subTypeIcon(submType);
            const isProcessing = processing === sub.id;
            const imageUrl = meta.submission_url || meta.submission_fields?.find((f: any) => f.type === "photo" || f.type === "screenshot")?.value;

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
                      {submType}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(sub.started_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Submitted data */}
                {renderSubmissionData(meta)}

                {/* Image preview thumbnail */}
                {imageUrl && (
                  <button
                    onClick={() => setSelected(sub)}
                    className="w-full rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-colors"
                  >
                    <img
                      src={imageUrl}
                      alt="Submission"
                      className="w-full max-h-40 object-contain bg-secondary/30"
                    />
                    <p className="text-[9px] text-muted-foreground py-1 text-center">Tap to enlarge</p>
                  </button>
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

                {filter !== "pending" && (
                  <div className="text-[10px] text-center text-muted-foreground">
                    {filter === "completed" ? "✅ Approved" : "❌ Rejected"}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-sm w-full rounded-2xl overflow-hidden bg-card border border-border"
            >
              {(() => {
                const imgUrl = selected.metadata?.submission_url ||
                  selected.metadata?.submission_fields?.find((f: any) => f.type === "photo" || f.type === "screenshot")?.value;
                return imgUrl ? (
                  <img src={imgUrl} alt="Submission" className="w-full max-h-96 object-contain" />
                ) : null;
              })()}
              <div className="p-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-lg" onClick={() => setSelected(null)}>Close</Button>
                {selected.status === "pending" && (
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs rounded-lg bg-success/20 text-success border border-success/30 hover:bg-success/30"
                    variant="outline"
                    disabled={processing === selected.id}
                    onClick={() => approve(selected)}
                  >
                    {processing === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
