import { useEffect, useRef } from "react";

/**
 * Renders raw HTML ad markup safely into a contained slot.
 * Re-runs any <script> tags so ad SDKs can initialize.
 */
export function AdSlot({ html, className }: { html?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html || "";
    if (!html) return;

    // Re-execute scripts (innerHTML doesn't run them)
    const scripts = Array.from(el.querySelectorAll("script"));
    scripts.forEach((old) => {
      const next = document.createElement("script");
      for (const attr of Array.from(old.attributes)) {
        next.setAttribute(attr.name, attr.value);
      }
      next.text = old.text;
      old.parentNode?.replaceChild(next, old);
    });
  }, [html]);

  if (!html) return null;
  return <div ref={ref} className={className} />;
}

/** Inject HTML (typically <script src=...>) into <head> exactly once per page load. */
export function injectHeadHtml(html?: string) {
  if (!html || typeof document === "undefined") return;
  const marker = "data-shortlink-head-injected";
  if (document.head.querySelector(`[${marker}]`)) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  Array.from(wrap.children).forEach((node) => {
    if (node.tagName === "SCRIPT") {
      const s = document.createElement("script");
      for (const attr of Array.from((node as HTMLElement).attributes)) {
        s.setAttribute(attr.name, attr.value);
      }
      s.text = (node as HTMLElement).textContent || "";
      s.setAttribute(marker, "1");
      document.head.appendChild(s);
    } else {
      (node as HTMLElement).setAttribute(marker, "1");
      document.head.appendChild(node);
    }
  });
}
