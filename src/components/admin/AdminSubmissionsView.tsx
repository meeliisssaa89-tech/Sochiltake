import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Loader2, Camera, Mail, FileText, CreditCard,
  User, ExternalLink, Image as ImageIcon, Copy, ChevronDown, ChevronUp,
} from "lucide-react";
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

const SQL_MIGRATION = `-- Paste in Supabase SQL Editor (once):
CREATE OR REPLACE FUNCTION public.admin_approve_submission(
  p_user_task_id uuid, p_user_id text,
  p_currency_id uuid DEFAULT NULL,
  p_reward_amount numeric DEFAULT 0, p_xp_reward int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_tasks SET status='completed', completed_at=NOW() WHERE id=p_user_task_id;
  IF p_reward_amount>0 AND p_currency_id IS NOT NULL THEN
    INSERT INTO balances(user_id,currency_id,amount) VALUES(p_user_id,p_currency_id,p_reward_amount)
    ON CONFLICT(user_id,currency_id) DO UPDATE SET amount=balances.amount+p_reward_amount;
  END IF;
  IF p_xp_reward>0 THEN UPDATE users SET exp=COALESCE(exp,0)+p_xp_reward WHERE telegram_id=p_user_id; END IF;
  RETURN jsonb_build_object('ok',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error',SQLERRM); END; $$;

CREATE OR REPLACE FUNCTION public.admin_reject_submission(p_user_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_tasks SET status='rejected' WHERE id=p_user_task_id;
  RETURN jsonb_build_object('ok',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error',SQLERRM); END; $$;`;

function SqlSetupBanner() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(SQL_MIGRATION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-yellow-400 font-semibold"
      >
        <span>⚙️ One-time SQL setup required for approve/reject</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="space-y-2">
          <p className="text-[10px] text-yellow-300/70">
            Open your{" "}
            <a
              href={`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID || "_"}/sql`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Supabase SQL Editor
            </a>
            , paste this SQL and click Run.
          </p>
          <pre className="text-[9px] text-white/60 bg-black/30 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">
            {SQL_MIGRATION}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] rounded-lg border-yellow-500/40 text-yellow-400"
            onClick={copy}
          >
            <Copy className="w-3 h-3 me-1" />
            {copied ? "Copied!" : "Copy SQL"}
          </Button>
        </div>
      )}
    </div>
  );
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
    if (!confirm(`Approve and credit ${sub.tasks.reward_amount} ${sub.tasks.currencies?.symbol || ""}?`)) return;
    setProcessing(sub.id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("admin_approve_submission", {
        p_user_task_id: sub.id,
        p_user_id: sub.user_id,
        p_currency_id: sub.tasks.reward_currency_id || null,
        p_reward_amount: sub.tasks.reward_amount || 0,
        p_xp_reward: sub.tasks.xp_reward || 0,
      });
      if (rpcError || (rpcData as any)?.error) {
        throw new Error(rpcError?.message || (rpcData as any)?.error || "Approval failed");
      }
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast({ title: "✅ Approved", description: "Reward credited to user." });
      if (selected?.id === sub.id) setSelected(null);
    } catch (err: any) {
      const msg: string = err.message || "";
      if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("function")) {
        toast({ title: "SQL setup needed", description: "Run the SQL at the top of this page in Supabase.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (sub: Submission) => {
    if (!confirm("Reject this submission?")) return;
    setProcessing(sub.id);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("admin_reject_submission", {
        p_user_task_id: sub.id,
      });
      if (rpcError || (rpcData as any)?.error) {
        throw new Error(rpcError?.message || (rpcData as any)?.error || "Rejection failed");
      }
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast({ title: "Rejected" });
      if (selected?.id === sub.id) setSelected(null);
    } catch (err: any) {
      const msg: string = err.message || "";
      if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("function")) {
        toast({ title: "SQL setup needed", description: "Run the SQL at the top of this page in Supabase.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
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

  const renderSubmissionData = (meta: any) => {
    const items: { label: string; value: string; isImage?: boolean; isSecret?: boolean }[] = [];

    if (Array.isArray(meta?.submission_fields)) {
      for (const f of meta.submission_fields) {
        if (!f?.value) continue;
        const isImage = f.type === "photo" || f.type === "screenshot" || String(f.value).match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
        items.push({ label: f.label || f.type || "Field", value: String(f.value), isImage: !!isImage, isSecret: f.type === "password" });
      }
    }

    if (meta?.submission_email) items.push({ label: "Email", value: meta.submission_email });
    if (meta?.submission_password) items.push({ label: "Password", value: meta.submission_password, isSecret: true });
    if (meta?.submission_gmail_password) items.push({ label: "Gmail Password", value: meta.submission_gmail_password, isSecret: true });
    if (meta?.submission_account_password) items.push({ label: "Account Password", value: meta.submission_account_password, isSecret: true });
    if (meta?.submission_text) items.push({ label: "Note", value: meta.submission_text });
    if (meta?.submission_url) {
      const isImage = String(meta.submission_url).match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
      items.push({ label: "Attachment", value: meta.submission_url, isImage: !!isImage });
    }
    if (Array.isArray(meta?.submission_images)) {
      meta.submission_images.forEach((url: string, i: number) => {
        if (url && url !== meta.submission_url) {
          items.push({ label: `Image ${i + 1}`, value: url, isImage: true });
        }
      });
    }

    if (items.length === 0) return null;
    return (
      <div className="p-2 rounded-lg bg-secondary/40 space-y-1.5">
        {items.map((item, i) => (
          <div key={i}>
            <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
            {item.isImage ? (
              <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-1 hover:underline mt-0.5">
                <ImageIcon className="w-3 h-3" /> View image <ExternalLink className="w-2.5 h-2.5" />
              </a>
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
      <SqlSetupBanner />

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
            {f === "pending" && filter === "pending" && (submissions?.length ?? 0) > 0 && (
              <span className="ms-1 bg-destructive text-destructive-foreground text-[9px] px-1.5 rounded-full">
                {submissions!.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !submissions?.length ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No {filter} submissions</div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub) => {
            const meta = sub.metadata || {};
            const submType = meta.submission_type || "text";
            const SubIcon = subTypeIcon(submType);
            const isProcessing = processing === sub.id;
            const imageUrl =
              meta.submission_url ||
              (Array.isArray(meta.submission_images) ? meta.submission_images[0] : null) ||
              meta.submission_fields?.find((f: any) => f.type === "photo" || f.type === "screenshot")?.value;

            return (
              <motion.div key={sub.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-3 space-y-2">
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
                      <SubIcon className="w-3 h-3" />{submType}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(sub.started_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {renderSubmissionData(meta)}

                {imageUrl && (
                  <button
                    onClick={() => setSelected(sub)}
                    className="w-full rounded-lg overflow-hidden border border-border/40 hover:border-primary/40 transition-colors"
                  >
                    <img src={imageUrl} alt="Submission" className="w-full max-h-40 object-contain bg-secondary/30" />
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

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-sm w-full rounded-2xl overflow-hidden bg-card border border-border"
            >
              {(() => {
                const imgUrl =
                  selected.metadata?.submission_url ||
                  (Array.isArray(selected.metadata?.submission_images) ? selected.metadata.submission_images[0] : null) ||
                  selected.metadata?.submission_fields?.find((f: any) => f.type === "photo" || f.type === "screenshot")?.value;
                return imgUrl ? <img src={imgUrl} alt="Submission" className="w-full max-h-96 object-contain" /> : null;
              })()}
              <div className="p-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-lg" onClick={() => setSelected(null)}>
                  Close
                </Button>
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
