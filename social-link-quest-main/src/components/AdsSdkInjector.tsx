import { useEffect } from "react";
import { useAppSettings } from "@/hooks/useSupabaseData";

const ADSGRAM_SDK = "https://sad.adsgram.ai/js/sad.min.js";

/**
 * Injects ad SDK scripts into <head> based on admin config:
 * - Adgram: always loads sad.min.js when blockId is set
 * - Monetag / Custom: loads admin-provided sdk_html
 */
export function AdsSdkInjector() {
  const { data: settings } = useAppSettings();
  const platforms: any = settings?.ads_platforms || {};

  useEffect(() => {
    document.head.querySelectorAll('[data-ads-sdk="1"]').forEach((n) => n.remove());

    const injectScript = (src: string, id: string) => {
      if (document.querySelector(`[data-ads-sdk-id="${id}"]`)) return;
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute("data-ads-sdk", "1");
      s.setAttribute("data-ads-sdk-id", id);
      document.head.appendChild(s);
    };

    const injectHtml = (html: string, tag: string) => {
      if (!html?.trim()) return;
      const container = document.createElement("div");
      container.innerHTML = html;
      Array.from(container.children).forEach((node) => {
        if (node.tagName === "SCRIPT") {
          const original = node as HTMLScriptElement;
          const script = document.createElement("script");
          Array.from(original.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
          script.text = original.text;
          script.setAttribute("data-ads-sdk", "1");
          script.setAttribute("data-ads-sdk-id", tag);
          document.head.appendChild(script);
        } else {
          const el = node as HTMLElement;
          el.setAttribute("data-ads-sdk", "1");
          el.setAttribute("data-ads-sdk-id", tag);
          document.head.appendChild(el);
        }
      });
    };

    if (platforms.adgram?.enabled && platforms.adgram?.block_id) {
      injectScript(ADSGRAM_SDK, "adsgram");
    }

    if (platforms.montag?.enabled && platforms.montag?.sdk_html) {
      injectHtml(platforms.montag.sdk_html, "montag");
    }

    if (platforms.custom?.enabled && platforms.custom?.sdk_html) {
      injectHtml(platforms.custom.sdk_html, "custom");
    }

    const legacySdkHtml = settings?.ads_sdk_html as string;
    if (legacySdkHtml?.trim()) {
      injectHtml(legacySdkHtml, "legacy");
    }
  }, [platforms.adgram?.enabled, platforms.adgram?.block_id, platforms.montag?.enabled, platforms.montag?.sdk_html, platforms.custom?.enabled, platforms.custom?.sdk_html, settings?.ads_sdk_html]);

  return null;
}
