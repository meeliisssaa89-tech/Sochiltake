interface GradientAvatarProps {
  name?: string;
  size?: number;
  className?: string;
}

const PALETTES = [
  { stops: ["#0052FF", "#00C3FF", "#00E8A3"] },
  { stops: ["#6B21FF", "#C026D3", "#F43F5E"] },
  { stops: ["#F97316", "#FACC15", "#84CC16"] },
  { stops: ["#0EA5E9", "#6366F1", "#8B5CF6"] },
  { stops: ["#10B981", "#06B6D4", "#3B82F6"] },
  { stops: ["#F43F5E", "#F97316", "#FACC15"] },
  { stops: ["#8B5CF6", "#EC4899", "#F97316"] },
  { stops: ["#14B8A6", "#0EA5E9", "#6366F1"] },
];

export function GradientAvatar({ name, size = 48, className }: GradientAvatarProps) {
  const idx = name
    ? [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % PALETTES.length
    : 0;
  const { stops } = PALETTES[idx];
  const letter = name?.[0]?.toUpperCase() || "U";
  const fontSize = Math.round(size * 0.38);

  const gradId = `ga-${idx}-${size}`;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)`,
        boxShadow: `0 4px 20px ${stops[0]}66, 0 0 0 1.5px rgba(255,255,255,0.18)`,
      }}
    >
      {/* Glass highlight */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          borderRadius: "50% 50% 0 0 / 55% 55% 0 0",
          background: "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Shine dot */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "18%",
          width: "28%",
          height: "22%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          color: "rgba(255,255,255,0.97)",
          fontWeight: 800,
          fontSize: `${fontSize}px`,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          position: "relative",
          userSelect: "none",
          textShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      >
        {letter}
      </span>
    </div>
  );
}
