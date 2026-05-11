import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useCurrencies, useVerifyTask } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import {
  X, Coins, Star, CheckCircle2, Loader2, Send, Globe, Eye,
  Upload, Camera, Mail, CreditCard, FileText, ExternalLink, RotateCw,
  Clock, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TaskSheetProps {
  task: any | null;
  open: boolean;
  onClose: () => void;
  isCompleted: boolean;
  isPending: boolean;
  isLoading: boolean;
  onStart: () => void;
  onVerify: (code?: string) => void;
  codeInput: string;
  onCodeChange: (v: string) => void;
}

const taskTypeIcon: Record<string, any> = {
  telegram_join: Send,
  social_link: Globe,
  watch_ad: Eye,
  code_api: Globe,
  submission: Upload,
};

const taskTypeLabel: Record<string, Record<string, string>> = {
  telegram_join: { en: "Telegram", ar: "تيليغرام" },
  social_link:   { en: "Social",   ar: "سوشيال" },
  watch_ad:      { en: "Watch Ad", ar: "مشاهدة إعلان" },
  code_api:      { en: "Code",     ar: "كود" },
  submission:    { en: "Submit",   ar: "تقديم" },
};

const submissionIcons: Record<string, any> = {
  photo: Camera,
  email: Mail,
  id_document: CreditCard,
  text: FileText,
};

export function TaskSheet({
  task,
  open,
  onClose,
  isCompleted,
  isPending,
  isLoading,
  onStart,
  onVerify,
  codeInput,
  onCodeChange,
}: TaskSheetProps) {
  const { t, language } = useLanguage();
  const { user } = useUser();
  const { toast } = useToast();
  const { data: allCurrencies } = useCurrencies();
  const verifyMutation = useVerifyTask();

  const [submitting, setSubmitting] = useState(false);
  const [submissionText, setSubmissionText] = useState("");
  const [submissionEmail, setSubmissionEmail] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionPreview, setSubmissionPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!task) return null;

  const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
  const description = language === "ar" && task.description_ar ? task.description_ar : (task.description_en || "");
  const TypeIcon = taskTypeIcon[task.type] || Star;
  const typeLabel = taskTypeLabel[task.type]?.[language === "ar" ? "ar" : "en"] || task.type;

  const submissionType: string = task.metadata?.submission_type || "text";
  const submissionLabel: string = task.metadata?.submission_label || (
    submissionType === "photo" ? "Upload a photo as proof" :
    submissionType === "email" ? "Enter your email address" :
    submissionType === "id_document" ? "Upload your ID document" :
    "Write your submission"
  );
  const SubIcon = submissionIcons[submissionType] || FileText;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmissionFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setSubmissionPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!user?.telegram_id || !task) return;

    if (submissionType === "photo" || submissionType === "id_document") {
      if (!submissionFile) {
        toast({ title: t("error"), description: "Please upload a file first", variant: "destructive" });
        return;
      }
    }
    if (submissionType === "email" && !submissionEmail.includes("@")) {
      toast({ title: t("error"), description: "Please enter a valid email", variant: "destructive" });
      return;
    }
    if (submissionType === "text" && !submissionText.trim()) {
      toast({ title: t("error"), description: "Please enter your submission", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let submissionUrl = "";
      if ((submissionType === "photo" || submissionType === "id_document") && submissionFile) {
        const path = `task-submissions/${user.telegram_id}/${task.id}-${Date.now()}`;
        const { data, error } = await supabase.storage
          .from("task-submissions")
          .upload(path, submissionFile, { upsert: true });
        if (error) throw new Error("Upload failed: " + error.message);
        const { data: urlData } = supabase.storage.from("task-submissions").getPublicUrl(data.path);
        submissionUrl = urlData.publicUrl;
      }

      await verifyMutation.mutateAsync({
        userId: user.telegram_id,
        taskId: task.id,
        action: "submit",
        submissionData: {
          submission_url: submissionUrl || undefined,
          submission_text: submissionText || undefined,
          submission_email: submissionEmail || undefined,
        },
      });

      toast({ title: t("success"), description: "Your submission is under review!" });
      onClose();
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
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
              background: "rgba(10,6,25,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div
              className="px-5 space-y-4 overflow-y-auto"
              style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom) + 5.5rem)", maxHeight: "82vh" }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                    style={{
                      background: isCompleted ? "rgba(34,197,94,0.15)" : task.icon_url ? "transparent" : "rgba(139,92,246,0.15)",
                      border: `1px solid ${isCompleted ? "rgba(34,197,94,0.3)" : "rgba(139,92,246,0.25)"}`,
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : task.icon_url ? (
                      <img src={task.icon_url} alt="" className="w-12 h-12 object-cover rounded-2xl" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <TypeIcon className="w-6 h-6 text-purple-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-white text-base leading-tight">{title}</h3>
                      {task.is_required && (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/25 text-[9px] px-1.5 py-0 h-4 shrink-0">
                          {t("required")}
                        </Badge>
                      )}
                    </div>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md inline-block mt-1"
                      style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
                    >
                      {typeLabel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Description */}
              {description && (
                <div
                  className="p-3.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-sm text-white/70 leading-relaxed">{description}</p>
                </div>
              )}

              {/* Rewards */}
              {(task.reward_amount > 0 || task.xp_reward > 0 || (task.extra_rewards?.length > 0)) && (
                <div
                  className="p-3.5 rounded-2xl space-y-2.5"
                  style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.18)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500/70">Rewards</p>
                  <div className="flex flex-wrap gap-2">
                    {task.reward_amount > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)" }}>
                        {task.currencies?.icon_url ? (
                          <img src={task.currencies.icon_url} alt="" className="w-4 h-4 rounded-full" />
                        ) : (
                          <Coins className="w-4 h-4 text-yellow-400" />
                        )}
                        <span className="text-sm font-bold text-yellow-300">
                          +{task.reward_amount} {task.currencies?.symbol || ""}
                        </span>
                      </div>
                    )}
                    {Array.isArray(task.extra_rewards) && task.extra_rewards.map((r: any, idx: number) => {
                      const cur = (allCurrencies || []).find((c: any) => c.id === r.currency_id);
                      if (!cur || !r.amount) return null;
                      return (
                        <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}>
                          {cur.icon_url ? (
                            <img src={cur.icon_url} alt="" className="w-4 h-4 rounded-full" />
                          ) : (
                            <Coins className="w-3.5 h-3.5 text-yellow-400" />
                          )}
                          <span className="text-sm font-bold text-yellow-300">+{r.amount} {cur.symbol}</span>
                        </div>
                      );
                    })}
                    {task.xp_reward > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                        style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
                        <Star className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-bold text-purple-300">+{task.xp_reward} EXP</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Completed state ── */}
              {isCompleted && (
                <div className="py-6 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.3)" }}>
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-green-400 text-base">{t("completed")}</p>
                    <p className="text-xs text-white/40 mt-1">You've already completed this task</p>
                  </div>
                </div>
              )}

              {/* ── Pending submission under review ── */}
              {!isCompleted && isPending && task.type === "submission" && (
                <div className="py-6 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(234,179,8,0.12)", border: "2px solid rgba(234,179,8,0.25)" }}>
                    <Clock className="w-8 h-8 text-yellow-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-yellow-400 text-base">Under Review</p>
                    <p className="text-xs text-white/40 mt-1">Your submission is being reviewed by our team</p>
                  </div>
                </div>
              )}

              {/* ── Submission form ── */}
              {!isCompleted && !isPending && task.type === "submission" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <SubIcon className="w-4 h-4 text-purple-400" />
                    <p className="text-sm font-semibold text-white/80">{submissionLabel}</p>
                  </div>

                  {(submissionType === "photo" || submissionType === "id_document") && (
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      {submissionPreview ? (
                        <div className="relative">
                          <img
                            src={submissionPreview}
                            alt="Preview"
                            className="w-full h-48 object-cover rounded-2xl"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                            style={{ background: "rgba(0,0,0,0.7)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-36 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all"
                          style={{
                            background: "rgba(139,92,246,0.06)",
                            border: "2px dashed rgba(139,92,246,0.3)",
                          }}
                        >
                          <Camera className="w-8 h-8 text-purple-400/60" />
                          <p className="text-sm text-white/40">Tap to select {submissionType === "id_document" ? "document" : "photo"}</p>
                        </button>
                      )}
                    </div>
                  )}

                  {submissionType === "email" && (
                    <input
                      type="email"
                      value={submissionEmail}
                      onChange={(e) => setSubmissionEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  )}

                  {submissionType === "text" && (
                    <textarea
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      placeholder="Write your submission here..."
                      rows={4}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all resize-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || verifyMutation.isPending}
                    className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: "rgba(139,92,246,0.2)",
                      border: "1px solid rgba(139,92,246,0.4)",
                      color: "rgb(167,139,250)",
                    }}
                  >
                    {(submitting || verifyMutation.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Submit for Review
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ── code_api: code input when pending ── */}
              {!isCompleted && task.type === "code_api" && isPending && (
                <div className="space-y-3">
                  <p className="text-xs text-white/50 text-center">
                    Enter the code you received after completing the task
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={codeInput}
                      onChange={(e) => onCodeChange(e.target.value)}
                      placeholder="Enter code..."
                      className="flex-1 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none font-mono tracking-widest"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                    <button
                      onClick={() => onVerify(codeInput)}
                      disabled={isLoading || !codeInput.trim()}
                      className="px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                      style={{
                        background: "rgba(139,92,246,0.2)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        color: "rgb(167,139,250)",
                      }}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("verifyTask")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Action buttons ── */}
              {!isCompleted && task.type !== "submission" && (
                <div className="space-y-2 pt-1">
                  {task.type === "code_api" && !isPending && (
                    <button
                      onClick={onStart}
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{
                        background: "rgba(139,92,246,0.2)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        color: "rgb(167,139,250)",
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {t("startTask")}
                          <ExternalLink className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {task.type !== "code_api" && !isPending && (
                    <button
                      onClick={onStart}
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{
                        background: "rgba(139,92,246,0.2)",
                        border: "1px solid rgba(139,92,246,0.4)",
                        color: "rgb(167,139,250)",
                      }}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t("startTask")}<ExternalLink className="w-4 h-4" /></>}
                    </button>
                  )}

                  {task.type !== "code_api" && isPending && (
                    <div className="flex gap-2">
                      <button
                        onClick={onStart}
                        disabled={isLoading}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                      >
                        <RotateCw className="w-4 h-4" />
                        {t("startTask")}
                      </button>
                      <button
                        onClick={() => onVerify()}
                        disabled={isLoading}
                        className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{
                          background: "rgba(139,92,246,0.2)",
                          border: "1px solid rgba(139,92,246,0.4)",
                          color: "rgb(167,139,250)",
                        }}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("verifyTask")}
                      </button>
                    </div>
                  )}

                  {task.type === "code_api" && isPending && (
                    <button
                      onClick={onStart}
                      disabled={isLoading}
                      className="w-full py-3 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Restart task (get new code)
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
