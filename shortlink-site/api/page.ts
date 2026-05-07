import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_lib/cors.js";
import { mainDb, getSettings } from "./_lib/supabase.js";
import { generateCode } from "./_lib/code.js";

/**
 * POST /api/page
 * body: { session_id: string, page: number }
 *
 * Advance to the requested page. Server enforces the wait timer between pages
 * and refuses to skip ahead. When the user completes the last page, a unique
 * code is generated and returned.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { session_id, page } = req.body || {};
  if (!session_id || typeof page !== "number") {
    return res.status(400).json({ error: "session_id and page are required" });
  }

  const { data: session } = await mainDb
    .from("task_code_sessions")
    .select("*")
    .eq("id", session_id)
    .maybeSingle();
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.used_at) return res.status(400).json({ error: "Session already used" });

  const articles = Array.isArray(session.articles) ? session.articles : [];
  const totalPages = articles.length;
  if (totalPages === 0) return res.status(400).json({ error: "Session not initialized" });

  const settings = await getSettings();
  const waitSeconds = Math.max(0, Math.min(120, Number(settings.wait_seconds || 8)));

  // Server-enforced: cannot jump more than one page ahead of pages_done
  const currentDone = session.pages_done || 0;
  if (page < 0 || page > totalPages) {
    return res.status(400).json({ error: "Invalid page index" });
  }
  if (page > currentDone + 1) {
    return res.status(400).json({ error: "Cannot skip ahead. Read pages in order." });
  }

  // Enforce wait timer
  if (page > currentDone) {
    const last = session.last_page_at ? new Date(session.last_page_at).getTime() : 0;
    const elapsed = (Date.now() - last) / 1000;
    if (elapsed < waitSeconds) {
      const remaining = Math.ceil(waitSeconds - elapsed);
      return res.status(429).json({
        error: `Please wait ${remaining}s more before continuing`,
        wait_remaining: remaining,
      });
    }
  }

  // Update progress
  let updates: any = { last_page_at: new Date().toISOString() };
  if (page > currentDone) updates.pages_done = page;

  // Did the user complete all pages?
  let code: string | null = session.code || null;
  let completed = !!session.completed_at;
  if (page >= totalPages && !completed) {
    if (!code) {
      // Generate unique code (retry on rare collision)
      for (let i = 0; i < 5; i++) {
        const attempt = generateCode();
        const { data, error } = await mainDb
          .from("task_code_sessions")
          .update({
            ...updates,
            code: attempt,
            pages_done: totalPages,
            completed_at: new Date().toISOString(),
          })
          .eq("id", session_id)
          .is("code", null)
          .select()
          .single();
        if (!error && data) {
          code = data.code;
          completed = true;
          break;
        }
      }
      if (!code) return res.status(500).json({ error: "Could not generate code, try again" });
    }
  } else {
    await mainDb.from("task_code_sessions").update(updates).eq("id", session_id);
  }

  const article = articles[Math.min(page, totalPages - 1)];
  return res.status(200).json({
    page,
    total_pages: totalPages,
    pages_done: completed ? totalPages : Math.max(currentDone, page),
    wait_seconds: waitSeconds,
    article,
    completed,
    code: completed ? code : null,
  });
}
