interface GradientAvatarProps {
  name?: string;
  size?: number;
  className?: string;
}

const PALETTES = [
  { a: "#6366f1", b: "#a855f7" },
  { a: "#3b82f6", b: "#06b6d4" },
  { a: "#f59e0b", b: "#ef4444" },
  { a: "#10b981", b: "#3b82f6" },
  { a: "#ec4899", b: "#8b5cf6" },
  { a: "#f97316", b: "#eab308" },
  { a: "#14b8a6", b: "#6366f1" },
  { a: "#8b5cf6", b: "#ec4899" },
];

export function GradientAvatar({ name, size = 48, className }: GradientAvatarProps) {
  const idx = name
    ? [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % PALETTES.length
    : 0;
  const { a, b } = PALETTES[idx];
  const letter = name?.[0]?.toUpperCase() || "U";
  const fontSize = Math.round(size * 0.38);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 38% 32%, ${a}, ${b} 80%)`,
        boxShadow: `0 4px 18px ${a}55, inset 0 1px 0 rgba(255,255,255,0.22)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "9%",
          left: "16%",
          width: "36%",
          height: "28%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          color: "rgba(255,255,255,0.95)",
          fontWeight: 700,
          fontSize: `${fontSize}px`,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          position: "relative",
          userSelect: "none",
        }}
      >
        {letter}
      </span>
    </div>
  );
}
