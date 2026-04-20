import { useState, useEffect, useRef } from "react";
import { LucideIcon } from "lucide-react";

interface AppIconProps {
  /** Optional URL or data-URI overriding the default. Supports png, jpg, svg, gif. */
  src?: string | null;
  /** Fallback Lucide icon when no src is provided */
  fallback: LucideIcon;
  className?: string;
  /** Size in pixels (applied to width and height) */
  size?: number;
  /** Color for fallback icon */
  color?: string;
  /** Trigger animation play on click for GIFs */
  playOnClick?: boolean;
}

/**
 * Universal icon renderer.
 * - If `src` ends with `.gif` and `playOnClick` is true, the gif is paused (rendered as a static frame)
 *   until the user clicks; on click it plays once then pauses again.
 * - Otherwise renders the image normally, or falls back to a Lucide icon.
 */
export function AppIcon({ src, fallback: Fallback, className, size = 24, color, playOnClick = true }: AppIconProps) {
  const isGif = !!src && /\.gif(\?|$)/i.test(src);
  const [playing, setPlaying] = useState(false);
  const [staticFrame, setStaticFrame] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // For GIFs that should be paused: render the first frame to a canvas/data url
  useEffect(() => {
    if (!isGif || !src || !playOnClick) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setStaticFrame(canvas.toDataURL("image/png"));
        }
      } catch {
        setStaticFrame(null);
      }
    };
    img.onerror = () => setStaticFrame(null);
    img.src = src;
  }, [src, isGif, playOnClick]);

  if (!src) {
    return <Fallback className={className} size={size} color={color} />;
  }

  const handleClick = () => {
    if (!isGif || !playOnClick) return;
    setPlaying(true);
    // Auto pause after a reasonable animation duration (3s)
    setTimeout(() => setPlaying(false), 3000);
  };

  if (isGif && playOnClick) {
    const showStatic = !playing && staticFrame;
    return (
      <img
        src={showStatic ? staticFrame! : src}
        alt=""
        width={size}
        height={size}
        onClick={handleClick}
        className={className}
        style={{ objectFit: "contain", cursor: playOnClick ? "pointer" : undefined }}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
