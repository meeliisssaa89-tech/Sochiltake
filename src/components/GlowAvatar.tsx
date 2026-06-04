import { motion } from "framer-motion";

  const GLOW_PALETTES = [
    { from: "#7c3aed", to: "#4f46e5", shadow: "0 0 20px 6px rgba(124,58,237,0.55), 0 0 40px 12px rgba(99,102,241,0.3)" },
    { from: "#06b6d4", to: "#3b82f6", shadow: "0 0 20px 6px rgba(6,182,212,0.55), 0 0 40px 12px rgba(59,130,246,0.3)" },
    { from: "#10b981", to: "#059669", shadow: "0 0 20px 6px rgba(16,185,129,0.55), 0 0 40px 12px rgba(5,150,105,0.3)" },
    { from: "#f59e0b", to: "#ef4444", shadow: "0 0 20px 6px rgba(245,158,11,0.55), 0 0 40px 12px rgba(239,68,68,0.3)" },
    { from: "#ec4899", to: "#8b5cf6", shadow: "0 0 20px 6px rgba(236,72,153,0.55), 0 0 40px 12px rgba(139,92,246,0.3)" },
    { from: "#f97316", to: "#eab308", shadow: "0 0 20px 6px rgba(249,115,22,0.55), 0 0 40px 12px rgba(234,179,8,0.3)" },
    { from: "#14b8a6", to: "#6366f1", shadow: "0 0 20px 6px rgba(20,184,166,0.55), 0 0 40px 12px rgba(99,102,241,0.3)" },
    { from: "#e879f9", to: "#06b6d4", shadow: "0 0 20px 6px rgba(232,121,249,0.55), 0 0 40px 12px rgba(6,182,212,0.3)" },
  ];

  function getPaletteIndex(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash % GLOW_PALETTES.length;
  }

  interface GlowAvatarProps {
    userId: string;
    name: string;
    size?: number;
    animate?: boolean;
    className?: string;
  }

  export function GlowAvatar({ userId, name, size = 56, animate = true, className = "" }: GlowAvatarProps) {
    const idx = getPaletteIndex(userId || name || "0");
    const palette = GLOW_PALETTES[idx];
    const initials = name ? name[0].toUpperCase() : "?";

    return (
      <motion.div
        className={`relative flex items-center justify-center rounded-full shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 35% 35%, ${palette.from}, ${palette.to})`,
          boxShadow: palette.shadow,
        }}
        animate={animate ? {
          boxShadow: [
            palette.shadow,
            palette.shadow.replace("0.55", "0.75").replace("0.3", "0.45"),
            palette.shadow,
          ],
        } : undefined}
        transition={animate ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <span
          className="font-bold text-white select-none"
          style={{ fontSize: size * 0.38, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
        >
          {initials}
        </span>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28), transparent 60%)",
          }}
        />
      </motion.div>
    );
  }
  