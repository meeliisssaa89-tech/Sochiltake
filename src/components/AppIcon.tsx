import { useState, useEffect } from "react";
import { LucideIcon } from "lucide-react";

interface AppIconProps {
  src?: string | null;
  fallback: LucideIcon;
  className?: string;
  size?: number;
  color?: string;
  playOnClick?: boolean;
}

function isGifSrc(src: string): boolean {
  return /\.gif(\?|$)/i.test(src) || src.startsWith("data:image/gif");
}

export function AppIcon({ src, fallback: Fallback, className, size = 24, color, playOnClick = true }: AppIconProps) {
  const isGif = !!src && isGifSrc(src);
  const [playing, setPlaying] = useState(false);
  const [staticFrame, setStaticFrame] = useState<string | null>(null);

  useEffect(() => {
    if (!isGif || !src || !playOnClick) return;
    setStaticFrame(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || size;
        canvas.height = img.naturalHeight || size;
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
  }, [src, isGif, playOnClick, size]);

  if (!src) {
    return <Fallback className={className} size={size} color={color} />;
  }

  const handleClick = () => {
    if (!isGif || !playOnClick) return;
    setPlaying(true);
    setTimeout(() => setPlaying(false), 3000);
  };

  if (isGif && playOnClick) {
    const showStatic = !playing && !!staticFrame;
    return (
      <img
        src={showStatic ? staticFrame! : src}
        alt=""
        width={size}
        height={size}
        onClick={handleClick}
        className={className}
        style={{ objectFit: "contain", cursor: "pointer" }}
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
