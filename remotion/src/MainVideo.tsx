import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });
const { fontFamily: spaceGrotesk } = loadSpaceGrotesk("normal", { weights: ["500", "700"], subsets: ["latin"] });

// Brand colors
const TEAL = "#0EA5E9";
const DARK = "#0B1120";
const GOLD = "#F59E0B";
const WHITE = "#F8FAFC";
const TEAL_DIM = "#0EA5E933";
const PURPLE = "#8B5CF6";

// Animated gradient background
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const hue1 = 200 + Math.sin(frame / 80) * 15;
  const hue2 = 260 + Math.cos(frame / 60) * 20;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 20%, hsl(${hue1}, 80%, 15%) 0%, ${DARK} 50%), radial-gradient(ellipse at 70% 80%, hsl(${hue2}, 60%, 12%) 0%, transparent 60%)`,
      }}
    />
  );
};

// Grid pattern overlay
const GridOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = 0.04 + Math.sin(frame / 100) * 0.02;
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width="100%" height="100%">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke={TEAL} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </AbsoluteFill>
  );
};

// Floating orbs
const FloatingOrbs: React.FC = () => {
  const frame = useCurrentFrame();
  const orbs = [
    { x: 150, y: 300, size: 200, color: TEAL, speed: 0.7 },
    { x: 800, y: 1200, size: 300, color: PURPLE, speed: 0.5 },
    { x: 600, y: 600, size: 150, color: GOLD, speed: 0.9 },
  ];
  return (
    <AbsoluteFill>
      {orbs.map((o, i) => {
        const y = o.y + Math.sin((frame * o.speed) / 30) * 40;
        const x = o.x + Math.cos((frame * o.speed) / 40) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - o.size / 2,
              top: y - o.size / 2,
              width: o.size,
              height: o.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${o.color}22, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Animated text with spring
const AnimText: React.FC<{
  text: string;
  fontSize?: number;
  color?: string;
  font?: string;
  weight?: number;
  delay?: number;
  maxWidth?: number;
}> = ({ text, fontSize = 64, color = WHITE, font = spaceGrotesk, weight = 700, delay = 0, maxWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <div
      style={{
        fontFamily: font,
        fontSize,
        fontWeight: weight,
        color,
        opacity: interpolate(s, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(s, [0, 1], [50, 0])}px)`,
        textAlign: "center",
        lineHeight: 1.15,
        maxWidth: maxWidth || "auto",
        letterSpacing: "-0.02em",
      }}
    >
      {text}
    </div>
  );
};

// Badge pill component
const Badge: React.FC<{ label: string; color: string; delay: number }> = ({ label, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 200 } });
  return (
    <div
      style={{
        fontFamily: inter,
        fontSize: 26,
        fontWeight: 600,
        color: WHITE,
        background: `${color}33`,
        border: `1.5px solid ${color}88`,
        borderRadius: 50,
        padding: "10px 24px",
        opacity: interpolate(s, [0, 1], [0, 1]),
        transform: `scale(${interpolate(s, [0, 1], [0.5, 1])})`,
      }}
    >
      {label}
    </div>
  );
};

// Scene 1: Hero intro
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });
  const pulse = 1 + Math.sin(frame / 12) * 0.015;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        {/* Logo */}
        <div
          style={{
            fontSize: 100,
            fontFamily: spaceGrotesk,
            fontWeight: 700,
            color: TEAL,
            transform: `scale(${interpolate(logoScale, [0, 1], [0.3, 1]) * pulse})`,
            textShadow: `0 0 60px ${TEAL}44`,
            letterSpacing: "-0.03em",
          }}
        >
          RickyAI
        </div>
        {/* Divider */}
        <div
          style={{
            width: interpolate(spring({ frame: frame - 10, fps, config: { damping: 20 } }), [0, 1], [0, 300]),
            height: 3,
            background: `linear-gradient(90deg, transparent, ${TEAL}, ${PURPLE}, transparent)`,
          }}
        />
        <AnimText text="Your 14-Step Business Growth Engine" fontSize={46} color={GOLD} delay={15} maxWidth={800} />
        <AnimText text="Powered by AI • Built for Small Business" fontSize={32} color={`${WHITE}99`} font={inter} weight={400} delay={25} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: 10 Optimization Layers
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const layers = [
    { label: "SEO", color: "#22C55E" },
    { label: "GEO", color: "#3B82F6" },
    { label: "AEO", color: "#8B5CF6" },
    { label: "SGE", color: "#F59E0B" },
    { label: "LMO", color: "#EF4444" },
    { label: "RMO", color: "#EC4899" },
    { label: "CRO", color: "#14B8A6" },
    { label: "DMO", color: "#F97316" },
    { label: "CAO", color: "#6366F1" },
    { label: "PAO", color: "#06B6D4" },
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <AnimText text="10 Optimization Layers" fontSize={56} color={TEAL} delay={0} />
        <AnimText text="One Unified Dashboard" fontSize={38} color={`${WHITE}88`} font={inter} weight={400} delay={8} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: 850, marginTop: 20 }}>
          {layers.map((l, i) => (
            <Badge key={l.label} label={l.label} color={l.color} delay={12 + i * 4} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Features
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const features = [
    "🎯 AI Strategy Engine",
    "🎬 Video Studio",
    "📊 Lead Scout & Audit",
    "🏆 Gamification & Rewards",
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 35 }}>
        <AnimText text="Everything You Need" fontSize={54} color={GOLD} delay={0} />
        {features.map((feat, i) => {
          const s = spring({ frame: frame - (i * 10 + 12), fps, config: { damping: 14 } });
          const x = interpolate(s, [0, 1], [i % 2 === 0 ? -500 : 500, 0]);
          return (
            <div
              key={i}
              style={{
                fontFamily: inter,
                fontSize: 40,
                fontWeight: 600,
                color: WHITE,
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${x}px)`,
                background: `linear-gradient(135deg, ${TEAL}15, ${PURPLE}15)`,
                border: `1px solid ${TEAL}33`,
                padding: "18px 40px",
                borderRadius: 16,
                width: 700,
                textAlign: "center",
              }}
            >
              {feat}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Pricing
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tiers = [
    { name: "Creator", price: "$59/mo", color: TEAL },
    { name: "Business", price: "$169/mo", color: GOLD },
    { name: "Growth", price: "$249/mo", color: PURPLE },
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <AnimText text="Plans That Scale With You" fontSize={52} delay={0} />
        <div style={{ display: "flex", gap: 30, marginTop: 20 }}>
          {tiers.map((t, i) => {
            const s = spring({ frame: frame - (i * 10 + 10), fps, config: { damping: 12 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  background: `${t.color}11`,
                  border: `2px solid ${t.color}55`,
                  borderRadius: 24,
                  padding: "40px 40px",
                  width: 240,
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  transform: `translateY(${interpolate(s, [0, 1], [80, 0])}px)`,
                }}
              >
                <div style={{ fontFamily: spaceGrotesk, fontSize: 30, fontWeight: 700, color: t.color }}>{t.name}</div>
                <div style={{ fontFamily: inter, fontSize: 42, fontWeight: 800, color: WHITE }}>{t.price}</div>
              </div>
            );
          })}
        </div>
        <AnimText text="7-Day Free Trial • No Credit Card" fontSize={28} color={`${WHITE}77`} font={inter} weight={400} delay={40} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: CTA
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + Math.sin(frame / 8) * 0.025;
  const glow = interpolate(Math.sin(frame / 15), [-1, 1], [20, 50]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <div
          style={{
            fontFamily: spaceGrotesk,
            fontSize: 90,
            fontWeight: 700,
            color: TEAL,
            transform: `scale(${pulse})`,
            textShadow: `0 0 ${glow}px ${TEAL}66`,
            letterSpacing: "-0.03em",
          }}
        >
          RickyAI
        </div>
        <AnimText text="Dominate Your Market." fontSize={52} color={GOLD} delay={5} />
        <div
          style={{
            fontFamily: inter,
            fontSize: 38,
            fontWeight: 700,
            color: DARK,
            background: `linear-gradient(135deg, ${TEAL}, ${PURPLE})`,
            padding: "22px 60px",
            borderRadius: 60,
            transform: `scale(${interpolate(spring({ frame: frame - 20, fps, config: { damping: 10 } }), [0, 1], [0.5, 1])})`,
            opacity: interpolate(spring({ frame: frame - 20, fps, config: { damping: 10 } }), [0, 1], [0, 1]),
            boxShadow: `0 0 40px ${TEAL}44`,
          }}
        >
          Start Free Today
        </div>
        <AnimText text="rickyai.app" fontSize={30} color={`${WHITE}66`} font={inter} weight={400} delay={35} />
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: DARK }}>
      <Background />
      <GridOverlay />
      <FloatingOrbs />
      <Sequence from={0} durationInFrames={100}><Scene1 /></Sequence>
      <Sequence from={100} durationInFrames={100}><Scene2 /></Sequence>
      <Sequence from={200} durationInFrames={100}><Scene3 /></Sequence>
      <Sequence from={300} durationInFrames={100}><Scene4 /></Sequence>
      <Sequence from={400} durationInFrames={100}><Scene5 /></Sequence>
    </AbsoluteFill>
  );
};
