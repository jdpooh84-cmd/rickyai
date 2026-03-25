import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  AbsoluteFill,
} from "remotion";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadLobster } from "@remotion/google-fonts/LobsterTwo";

const { fontFamily: poppins } = loadPoppins("normal", { weights: ["400", "700"], subsets: ["latin"] });
const { fontFamily: lobster } = loadLobster("normal", { weights: ["700"], subsets: ["latin"] });

const DONATOS_RED = "#C8102E";
const DONATOS_GOLD = "#F5A623";
const WARM_BG = "#1A0A00";
const CREAM = "#FFF8F0";

const script = {
  title: "Edge-to-Edge Perfection",
  tagline: "Every Piece is a Masterpiece",
  scene1: "Hungry for a pizza that doesn't skip the toppings?",
  scene2: "Famous edge-to-edge thin crust loaded with flavor.",
  scene3: "Perfect for family nights, catering, or a quick dine-in treat.",
  scene4: "Fresh ingredients & premium meats on every square slice.",
  cta: "Order now at Donatos.com!",
  hashtags: ["#DonatosPizza", "#EdgeToEdge", "#PizzaLover", "#FamilyDinner", "#PizzaNight"],
};

// Animated background with warm gradient
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = Math.sin(frame / 60) * 10;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% ${50 + shift}%, ${DONATOS_RED}33 0%, ${WARM_BG} 70%)`,
      }}
    />
  );
};

// Floating pizza slice shapes
const FloatingAccents: React.FC = () => {
  const frame = useCurrentFrame();
  const accents = [
    { x: 80, y: 200, size: 60, speed: 0.8, delay: 0 },
    { x: 900, y: 400, size: 45, speed: 1.2, delay: 20 },
    { x: 200, y: 1400, size: 55, speed: 0.6, delay: 10 },
    { x: 850, y: 1100, size: 40, speed: 1.0, delay: 30 },
    { x: 500, y: 800, size: 35, speed: 0.9, delay: 15 },
  ];
  return (
    <AbsoluteFill style={{ opacity: 0.15 }}>
      {accents.map((a, i) => {
        const y = a.y + Math.sin((frame + a.delay) / 40 * a.speed) * 30;
        const rotate = (frame + a.delay) * a.speed * 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: a.x,
              top: y,
              width: a.size,
              height: a.size,
              background: i % 2 === 0 ? DONATOS_RED : DONATOS_GOLD,
              borderRadius: "50% 50% 50% 0%",
              transform: `rotate(${rotate}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Text reveal component
const RevealText: React.FC<{
  text: string;
  fontSize?: number;
  color?: string;
  font?: string;
  bold?: boolean;
  delay?: number;
  align?: "center" | "left";
}> = ({ text, fontSize = 64, color = CREAM, font = poppins, bold = true, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const y = interpolate(s, [0, 1], [60, 0]);

  return (
    <div
      style={{
        fontFamily: font,
        fontSize,
        fontWeight: bold ? 700 : 400,
        color,
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: "center",
        lineHeight: 1.2,
        padding: "0 60px",
      }}
    >
      {text}
    </div>
  );
};

// Scene 1: Opening hook
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + Math.sin(frame / 15) * 0.02;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* Big Donatos logo text */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div
          style={{
            fontFamily: lobster,
            fontSize: 120,
            color: DONATOS_RED,
            transform: `scale(${pulse})`,
            textShadow: `0 0 40px ${DONATOS_RED}66`,
          }}
        >
          Donato's
        </div>
        <div
          style={{
            width: 200,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${DONATOS_GOLD}, transparent)`,
            opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
          }}
        />
        <RevealText text={script.scene1} fontSize={52} delay={20} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Value prop
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const barWidth = interpolate(
    spring({ frame: frame - 10, fps, config: { damping: 20 } }),
    [0, 1], [0, 800]
  );

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <RevealText text="EDGE-TO-EDGE" fontSize={90} color={DONATOS_GOLD} font={lobster} delay={5} />
        <div
          style={{
            width: barWidth,
            height: 6,
            background: `linear-gradient(90deg, ${DONATOS_RED}, ${DONATOS_GOLD})`,
            borderRadius: 3,
          }}
        />
        <RevealText text={script.scene2} fontSize={46} delay={15} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Use cases
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const items = ["🍕 Family Nights", "🏢 Office Catering", "🍽️ Quick Dine-In"];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 50 }}>
        <RevealText text="Perfect For" fontSize={70} color={DONATOS_GOLD} font={lobster} delay={0} />
        {items.map((item, i) => {
          const s = spring({ frame: frame - (i * 12 + 15), fps: 30, config: { damping: 12 } });
          const x = interpolate(s, [0, 1], [i % 2 === 0 ? -400 : 400, 0]);
          const opacity = interpolate(s, [0, 1], [0, 1]);
          return (
            <div
              key={i}
              style={{
                fontFamily: poppins,
                fontSize: 48,
                fontWeight: 700,
                color: CREAM,
                opacity,
                transform: `translateX(${x}px)`,
                background: `${DONATOS_RED}33`,
                padding: "16px 40px",
                borderRadius: 16,
                border: `2px solid ${DONATOS_RED}66`,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Quality
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rotate = interpolate(frame, [0, 90], [0, 360]);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        {/* Spinning pizza shape */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50% 50% 50% 0%",
            background: `linear-gradient(135deg, ${DONATOS_RED}, ${DONATOS_GOLD})`,
            transform: `rotate(${rotate}deg)`,
            opacity: interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [0, 1]),
          }}
        />
        <RevealText text={script.scene4} fontSize={48} delay={10} />
        <RevealText text="🔥 Made Fresh Daily 🔥" fontSize={42} color={DONATOS_GOLD} delay={25} />
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: CTA + hashtags
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + Math.sin(frame / 8) * 0.03;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <RevealText text="Donato's Pizza" fontSize={80} color={DONATOS_RED} font={lobster} delay={0} />
        <div
          style={{
            fontFamily: poppins,
            fontSize: 44,
            fontWeight: 700,
            color: WARM_BG,
            background: `linear-gradient(135deg, ${DONATOS_GOLD}, ${DONATOS_RED})`,
            padding: "20px 50px",
            borderRadius: 20,
            transform: `scale(${pulse})`,
            opacity: interpolate(
              spring({ frame: frame - 15, fps, config: { damping: 12 } }),
              [0, 1], [0, 1]
            ),
          }}
        >
          {script.cta}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            padding: "0 40px",
            opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {script.hashtags.map((tag, i) => (
            <span
              key={i}
              style={{
                fontFamily: poppins,
                fontSize: 28,
                color: DONATOS_GOLD,
                background: `${DONATOS_RED}33`,
                padding: "8px 20px",
                borderRadius: 30,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: WARM_BG }}>
      <Background />
      <FloatingAccents />
      <Sequence from={0} durationInFrames={90}><Scene1 /></Sequence>
      <Sequence from={90} durationInFrames={90}><Scene2 /></Sequence>
      <Sequence from={180} durationInFrames={90}><Scene3 /></Sequence>
      <Sequence from={270} durationInFrames={90}><Scene4 /></Sequence>
      <Sequence from={360} durationInFrames={90}><Scene5 /></Sequence>
    </AbsoluteFill>
  );
};