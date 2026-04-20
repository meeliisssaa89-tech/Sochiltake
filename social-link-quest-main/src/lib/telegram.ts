// Telegram WebApp SDK helpers
type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticType = "error" | "success" | "warning";

export const tg = () => (window as any).Telegram?.WebApp;

export function hapticImpact(style: HapticStyle = "light") {
  try {
    tg()?.HapticFeedback?.impactOccurred(style);
  } catch {
    /* noop */
  }
}

export function hapticNotification(type: HapticType = "success") {
  try {
    tg()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    /* noop */
  }
}

export function hapticSelection() {
  try {
    tg()?.HapticFeedback?.selectionChanged();
  } catch {
    /* noop */
  }
}

export function openLink(url: string) {
  const w = tg();
  if (w?.openLink) {
    w.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

export function openTelegramLink(url: string) {
  const w = tg();
  if (w?.openTelegramLink) {
    w.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
}

export function shareUrl(url: string, text: string) {
  const w = tg();
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (w?.openTelegramLink) {
    w.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, "_blank");
  }
}
