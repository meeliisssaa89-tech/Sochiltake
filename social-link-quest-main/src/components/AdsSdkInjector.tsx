import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useSupabaseData";

/**
 * Injects the admin-provided ads SDK HTML/script tags into <head> at runtime.
 * The admin pastes raw HTML (e.g. <script src="..."></script>) and we apply it.
 * Tagged with data-ads-sdk="1" so we can clean up safely on changes.
 */
export function AdsSdkInjector() {
  const { data: settings } = useAppSettings();
  const html = (settings?.ads_sdk_html as string) || "";

  useEffect(() => {
    // Remove any prior injected nodes
    document.head.querySelectorAll('[data-ads-sdk="1"]').forEach((n) => n.remove());
    if (!html.trim()) return;

    const container = document.createElement("div");
    container.innerHTML = html;

    Array.from(container.children).forEach((node) => {
      if (node.tagName === "SCRIPT") {
        const original = node as HTMLScriptElement;
        const script = document.createElement("script");
        Array.from(original.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
        script.text = original.text;
        script.setAttribute("data-ads-sdk", "1");
        document.head.appendChild(script);
      } else {
        const el = node as HTMLElement;
        el.setAttribute("data-ads-sdk", "1");
        document.head.appendChild(el);
      }
    });
  }, [html]);

  return null;
}
