import { useState, useRef, useEffect } from "react";
  import { motion, AnimatePresence } from "framer-motion";
  import { useLanguage } from "@/contexts/LanguageContext";
  import { useUser } from "@/contexts/UserContext";
  import { useCurrencies, useVerifyTask } from "@/hooks/useSupabaseData";
  import { supabase } from "@/integrations/supabase/client";
  import {
    X, Coins, Star, CheckCircle2, Loader2, Send, Globe, Eye,
    Upload, Camera, Mail, CreditCard, FileText, ExternalLink, RotateCw,
    Clock, ChevronRight, Lock, Image as ImageIcon,
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

  function flagEmoji(code: string) {
    if (!code || code.length !== 2) return "";
    return code.toUpperCase().split("").map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
  }

  function VideoEmbed({ url }: { url: string }) {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return (
        <div className="w-full rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <video
        src={url}
        controls
        className="w-full rounded-xl"
        style={{ maxHeight: 240 }}
        playsInline
      />
    );
  }

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
    const [submissionPassword, setSubmissionPassword] = useState("");
    const [submissionGmailPassword, setSubmissionGmailPassword] = useState("");
    const [submissionAccountPassword, setSubmissionAccountPassword] = useState("");
    const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
    const [submissionPreviews, setSubmissionPreviews] = useState<string[]>([]);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (!open || !task) return;
      setSubmissionFiles([]);
      setSubmissionPreviews([]);
      setSubmissionText("");
      setSubmissionEmail("");
      setSubmissionPassword("");
      setSubmissionGmailPassword("");
      setSubmissionAccountPassword("");
      const duration = task.metadata?.task_duration_seconds;
      if (duration && task.type === "submission") {
        setTimeLeft(Number(duration));
        const interval = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev === null || prev <= 0) { clearInterval(interval); return 0; }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(interval);
      } else {
        setTimeLeft(null);
      }
    }, [open, task?.id]);

    if (!task) return null;

    const title = language === "ar" && task.title_ar ? task.title_ar : task.title_en;
    const description = language === "ar" && task.description_ar ? task.description_ar : (task.description_en || "");
    const TypeIcon = taskTypeIcon[task.type] || Star;
    const typeLabel = taskTypeLabel[task.type]?.[language === "ar" ? "ar" : "en"] || task.type;

    // Submission fields approach (new)
    const submissionFields: string[] = Array.isArray(task.metadata?.submission_fields) ? task.metadata.submission_fields : [];
    const useNewFields = submissionFields.length > 0;

    // Legacy submission type approach
    const submissionType: string = task.metadata?.submission_type || "text";
    const submissionLabel: string = task.metadata?.submission_label || (
      submissionType === "photo" ? "Upload a photo as proof" :
      submissionType === "email" ? "Enter your email address" :
      submissionType === "id_document" ? "Upload your ID document" :
      "Write your submission"
    );

    const countries: string[] = Array.isArray(task.metadata?.countries)
      ? task.metadata.countries
      : typeof task.metadata?.countries === "string"
        ? task.metadata.countries.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

    const maxAccounts = task.metadata?.max_accounts;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const maxImages = task?.metadata?.max_images ? Number(task.metadata.max_images) : 5;
      const combined = [...submissionFiles, ...files].slice(0, maxImages);
      setSubmissionFiles(combined);
      Promise.all(
        combined.map(
          (f) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target?.result as string);
              reader.readAsDataURL(f);
            })
        )
      ).then(setSubmissionPreviews);
      e.target.value = "";
    };

    const removeFile = (idx: number) => {
      setSubmissionFiles((prev) => prev.filter((_, i) => i !== idx));
      setSubmissionPreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
      if (!user?.telegram_id || !task) return;

      if (useNewFields) {
        if (submissionFields.includes("email") && !submissionEmail.includes("@")) {
          toast({ title: t("error"), description: language === "ar" ? "أدخل بريداً إلكترونياً صحيحاً" : "Please enter a valid email", variant: "destructive" });
          return;
        }
        if (submissionFields.includes("password") && !submissionPassword.trim()) {
          toast({ title: t("error"), description: language === "ar" ? "أدخل كلمة المرور" : "Please enter the password", variant: "destructive" });
          return;
        }
        if (submissionFields.includes("gmail_password") && !submissionGmailPassword.trim()) {
          toast({ title: t("error"), description: language === "ar" ? "أدخل كلمة مرور Gmail" : "Please enter Gmail password", variant: "destructive" });
          return;
        }
        if (submissionFields.includes("account_password") && !submissionAccountPassword.trim()) {
          toast({ title: t("error"), description: language === "ar" ? "أدخل كلمة مرور الحساب" : "Please enter account password", variant: "destructive" });
          return;
        }
        if (submissionFields.includes("screenshot") && !submissionFiles.length) {
          toast({ title: t("error"), description: language === "ar" ? "يرجى رفع لقطة شاشة" : "Please upload a screenshot", variant: "destructive" });
          return;
        }
      } else {
        if (submissionType === "photo" || submissionType === "id_document") {
          if (!submissionFiles.length) {
            toast({ title: t("error"), description: "Please upload at least one photo", variant: "destructive" });
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
      }

      if (timeLeft !== null && timeLeft > 0) {
        toast({ title: t("error"), description: `Please wait ${timeLeft}s before submitting`, variant: "destructive" });
        return;
      }

      setSubmitting(true);
      try {
        const submissionUrls: string[] = [];
        const needsUpload = useNewFields
          ? submissionFields.includes("screenshot")
          : (submissionType === "photo" || submissionType === "id_document");

        if (needsUpload && submissionFiles.length > 0) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          for (const file of submissionFiles) {
            const path = `task-submissions/${user.telegram_id}/${task.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const fd = new FormData();
            fd.append("file", file);
            fd.append("path", path);
            const res = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
              method: "POST",
              headers: { Authorization: `Bearer ${supabaseKey}` },
              body: fd,
            });
            const result = await res.json();
            if (!res.ok || result.error) throw new Error("Upload failed: " + (result.error || res.statusText));
            submissionUrls.push(result.url);
          }
        }

        await verifyMutation.mutateAsync({
          userId: user.telegram_id,
          taskId: task.id,
          action: "submit",
          submissionData: {
            submission_url: submissionUrls[0] || undefined,
            submission_images: submissionUrls.length > 1 ? submissionUrls : undefined,
            submission_text: submissionText || undefined,
            submission_email: submissionEmail || undefined,
            submission_password: submissionPassword || undefined,
            submission_gmail_password: submissionGmailPassword || undefined,
            submission_account_password: submissionAccountPassword || undefined,
          },
        });

        toast({ title: t("success"), description: language === "ar" ? "جارٍ مراجعة تقديمك!" : "Your submission is under review!" });
        onClose();
      } catch (err: any) {
        toast({ title: t("error"), description: err.message, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };

    const rewardCurrency = allCurrencies?.find((c: any) => c.id === task.reward_currency_id);

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
                        {/* Country flags */}
                        {countries.slice(0, 4).map((c) => (
                          <span key={c} className="text-base" title={c}>{flagEmoji(c)}</span>
                        ))}
                        {countries.length > 4 && (
                          <span className="text-[10px] text-white/40">+{countries.length - 4}</span>
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
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{description}</p>
                  </div>
                )}

                {/* Country restriction notice */}
                {countries.length > 0 && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-2"
                    style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}
                  >
                    <span className="text-lg">{countries.slice(0, 3).map(flagEmoji).join(" ")}</span>
                    <p className="text-xs text-yellow-300/80">
                      {language === "ar"
                        ? `متاح للدول: ${countries.join(", ")}`
                        : `Available in: ${countries.join(", ")}`}
                    </p>
                  </div>
                )}

                {/* Max accounts notice */}
                {maxAccounts && maxAccounts > 1 && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-2"
                    style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
                  >
                    <p className="text-xs text-emerald-300/80">
                      {language === "ar"
                        ? `يمكنك إرسال حتى ${maxAccounts} حسابات`
                        : `You can submit up to ${maxAccounts} accounts`}
                    </p>
                  </div>
                )}

                {/* Steps */}
                {Array.isArray(task.metadata?.steps) && task.metadata.steps.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(139,92,246,0.7)" }}>
                      {language === "ar" ? "خطوات الإنجاز" : "How to complete"}
                    </p>
                    {task.metadata.steps.map((step: any, i: number) => {
                      const stepTitle = language === "ar" && step.title_ar ? step.title_ar : step.title_en;
                      const stepDesc = language === "ar" && step.description_ar ? step.description_ar : step.description_en;
                      return (
                        <div
                          key={i}
                          className="rounded-2xl overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          {step.image_url && (
                            <img
                              src={step.image_url}
                              alt={stepTitle || `Step ${i + 1}`}
                              className="w-full object-cover"
                              style={{ maxHeight: 220 }}
                            />
                          )}
                          {step.video_url && !step.image_url && (
                            <VideoEmbed url={step.video_url} />
                          )}
                          <div className="p-3 flex items-start gap-2.5">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold"
                              style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)", color: "rgb(167,139,250)" }}
                            >
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              {stepTitle && <p className="text-sm font-semibold text-white/90 leading-snug">{stepTitle}</p>}
                              {stepDesc && <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{stepDesc}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Description images */}
                {Array.isArray(task.metadata?.description_images) && task.metadata.description_images.length > 0 && (
                  <div className="space-y-2">
                    {task.metadata.description_images.map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="w-full rounded-2xl object-cover" style={{ maxHeight: 280 }} />
                    ))}
                  </div>
                )}

                {/* Reward */}
                {task.reward_amount > 0 && (
                  <div
                    className="flex items-center gap-3 p-3.5 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {rewardCurrency?.icon_url ? (
                      <img src={rewardCurrency.icon_url} alt="" className="w-8 h-8 rounded-full object-contain shrink-0" />
                    ) : (
                      <Coins className="w-8 h-8 text-yellow-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">{t("reward")}</p>
                      <p className="text-lg font-black text-yellow-400">+{task.reward_amount} {rewardCurrency?.symbol || ""}</p>
                    </div>
                    {task.xp_reward > 0 && (
                      <div className="ms-auto">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">XP</p>
                        <p className="text-sm font-bold text-purple-400">+{task.xp_reward}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* App link button (for submission tasks) */}
                {task.metadata?.app_link && !isCompleted && (
                  <a
                    href={task.metadata.app_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold transition-all"
                    style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", color: "rgb(103,232,249)" }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    {task.metadata.app_link_label || (language === "ar" ? "فتح التطبيق" : "Open App")}
                  </a>
                )}

                {/* Timer */}
                {timeLeft !== null && timeLeft > 0 && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400 font-mono font-bold">
                      {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
                    </span>
                  </div>
                )}

                {/* ── SUBMISSION FORM ── */}
                {task.type === "submission" && !isCompleted && (
                  <div className="space-y-3">
                    {/* NEW: submission_fields approach */}
                    {useNewFields ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(139,92,246,0.7)" }}>
                          {language === "ar" ? "بيانات الحساب" : "Account Details"}
                        </p>

                        {submissionFields.includes("email") && (
                          <div>
                            <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {language === "ar" ? "البريد الإلكتروني" : "Email Address"}
                            </label>
                            <input
                              type="email"
                              value={submissionEmail}
                              onChange={(e) => setSubmissionEmail(e.target.value)}
                              placeholder="example@email.com"
                              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                            />
                          </div>
                        )}

                        {submissionFields.includes("password") && (
                          <div>
                            <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              {language === "ar" ? "كلمة المرور" : "Password"}
                            </label>
                            <input
                              type="text"
                              value={submissionPassword}
                              onChange={(e) => setSubmissionPassword(e.target.value)}
                              placeholder={language === "ar" ? "أدخل كلمة المرور" : "Enter password"}
                              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all font-mono"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                            />
                          </div>
                        )}

                        {submissionFields.includes("gmail_password") && (
                          <div>
                            <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {language === "ar" ? "كلمة مرور Gmail" : "Gmail Password"}
                            </label>
                            <input
                              type="text"
                              value={submissionGmailPassword}
                              onChange={(e) => setSubmissionGmailPassword(e.target.value)}
                              placeholder={language === "ar" ? "كلمة مرور Gmail" : "Gmail password"}
                              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all font-mono"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                            />
                          </div>
                        )}

                        {submissionFields.includes("account_password") && (
                          <div>
                            <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {language === "ar" ? "كلمة مرور الحساب" : "Account Password"}
                            </label>
                            <input
                              type="text"
                              value={submissionAccountPassword}
                              onChange={(e) => setSubmissionAccountPassword(e.target.value)}
                              placeholder={language === "ar" ? "كلمة مرور الحساب" : "Account password"}
                              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all font-mono"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                            />
                          </div>
                        )}

                        {submissionFields.includes("text") && (
                          <div>
                            <label className="text-xs text-white/50 mb-1 block">{language === "ar" ? "ملاحظات إضافية" : "Additional notes"}</label>
                            <textarea
                              value={submissionText}
                              onChange={(e) => setSubmissionText(e.target.value)}
                              placeholder={language === "ar" ? "اكتب هنا..." : "Write here..."}
                              rows={3}
                              className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all resize-none"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                            />
                          </div>
                        )}

                        {submissionFields.includes("screenshot") && (
                          <div>
                            <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {language === "ar" ? "لقطة الشاشة" : "Screenshot"}
                            </label>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                            {submissionPreviews.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {submissionPreviews.map((preview, idx) => (
                                  <div key={idx} className="relative aspect-square">
                                    <img src={preview} alt="" className="w-full h-full object-cover rounded-lg" />
                                    <button
                                      onClick={() => removeFile(idx)}
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                                    >
                                      <X className="w-3 h-3 text-white" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm text-white/60 transition-all hover:text-white/80"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)" }}
                            >
                              <Camera className="w-4 h-4" />
                              {language === "ar" ? "رفع لقطة شاشة" : "Upload Screenshot"}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      /* LEGACY: submission_type approach */
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-white/80">{submissionLabel}</p>
                        </div>

                        {(submissionType === "photo" || submissionType === "id_document") && (
                          <div className="space-y-2">
                            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                            {submissionPreviews.length > 0 && (
                              <div className="grid grid-cols-3 gap-2">
                                {submissionPreviews.map((preview, idx) => (
                                  <div key={idx} className="relative aspect-square">
                                    <img src={preview} alt="" className="w-full h-full object-cover rounded-xl" />
                                    <button
                                      onClick={() => removeFile(idx)}
                                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                                    >
                                      <X className="w-3 h-3 text-white" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {submissionFiles.length < (task.metadata?.max_images || 5) && (
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 rounded-2xl flex flex-col items-center gap-1.5 text-white/50 transition-all hover:text-white/70"
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.15)" }}
                              >
                                <Camera className="w-6 h-6" />
                                <p className="text-xs">Tap to upload {submissionType === "id_document" ? "document" : "photos"}</p>
                                <p className="text-[10px] text-white/25">Up to {task.metadata?.max_images || 5} images</p>
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
                      </>
                    )}

                    {isPending ? (
                      <div
                        className="w-full py-3 rounded-2xl text-sm font-bold text-center"
                        style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "rgb(234,179,8)" }}
                      >
                        {language === "ar" ? "⏳ قيد المراجعة" : "⏳ Under Review"}
                      </div>
                    ) : (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || verifyMutation.isPending || (timeLeft !== null && timeLeft > 0)}
                        className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "rgb(167,139,250)" }}
                      >
                        {(submitting || verifyMutation.isPending) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            {language === "ar" ? "إرسال للمراجعة" : "Submit for Review"}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Telegram Join action */}
                {task.type === "telegram_join" && !isCompleted && (
                  <div className="space-y-2">
                    {task.metadata?.channel_url && (
                      <a
                        href={task.metadata.channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onStart}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold"
                        style={{ background: "rgba(39,174,239,0.15)", border: "1px solid rgba(39,174,239,0.3)", color: "rgb(39,174,239)" }}
                      >
                        <Send className="w-4 h-4" />
                        {language === "ar" ? "انضم للقناة" : "Join Channel"}
                      </a>
                    )}
                    <button
                      onClick={() => onVerify()}
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.35)", color: "rgb(167,139,250)" }}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />{language === "ar" ? "تحقق من الانضمام" : "Verify Join"}</>}
                    </button>
                  </div>
                )}

                {/* Social link / watch ad action */}
                {(task.type === "social_link" || task.type === "watch_ad") && !isCompleted && (
                  <div className="space-y-2">
                    {(task.metadata?.redirect_url || task.metadata?.channel_url) && (
                      <a
                        href={task.metadata?.redirect_url || task.metadata?.channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onStart}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold"
                        style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", color: "rgb(103,232,249)" }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        {language === "ar" ? "فتح الرابط" : "Open Link"}
                      </a>
                    )}
                    <button
                      onClick={() => onVerify()}
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: "rgba(139,92,246,0.18)", border: "1px solid rgba(139,92,246,0.35)", color: "rgb(167,139,250)" }}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />{language === "ar" ? "تأكيد الإنجاز" : "Confirm Complete"}</>}
                    </button>
                  </div>
                )}

                {/* Code API action */}
                {task.type === "code_api" && !isCompleted && (
                  <div className="space-y-2">
                    {task.metadata?.redirect_url && (
                      <a
                        href={task.metadata.redirect_url.replace("{{user_id}}", user?.telegram_id || "")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onStart}
                        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-sm font-bold"
                        style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", color: "rgb(103,232,249)" }}
                      >
                        <ExternalLink className="w-4 h-4" />
                        {language === "ar" ? "احصل على الكود" : "Get Code"}
                      </a>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codeInput}
                        onChange={(e) => onCodeChange(e.target.value)}
                        placeholder={language === "ar" ? "أدخل الكود هنا" : "Enter code here"}
                        className="flex-1 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                      <button
                        onClick={() => onVerify(codeInput)}
                        disabled={isLoading || !codeInput.trim()}
                        className="px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center gap-1.5"
                        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "rgb(167,139,250)" }}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Completed state */}
                {isCompleted && (
                  <div
                    className="w-full py-4 rounded-2xl text-center"
                    style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-1" />
                    <p className="text-sm font-bold text-green-400">{t("taskCompleted")}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  