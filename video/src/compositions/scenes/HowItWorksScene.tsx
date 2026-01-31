import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

const VIOLET = "#8B5CF6";

interface StepProps {
  label: string;
  emoji: string;
  delay: number;
}

const Step: React.FC<StepProps> = ({ label, emoji, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200 },
    delay,
  });

  const x = interpolate(entrance, [0, 1], [60, 0]);
  const scale = interpolate(entrance, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        opacity: entrance,
        transform: `translateX(${x}px) scale(${scale})`,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "24px 40px",
        borderRadius: 16,
        backgroundColor: "#18181B",
        border: `1px solid ${VIOLET}33`,
        marginBottom: 20,
      }}
    >
      <span style={{ fontSize: 56 }}>{emoji}</span>
      <span
        style={{
          fontSize: 44,
          fontWeight: 700,
          color: "#FFFFFF",
          fontFamily,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const HowItWorksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 0.5 * fps,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
        padding: 60,
      }}
    >
      <div
        style={{
          opacity: headingEntrance,
          fontSize: 40,
          fontWeight: 600,
          color: VIOLET,
          fontFamily,
          marginBottom: 60,
          letterSpacing: "3px",
          textTransform: "uppercase",
        }}
      >
        How It Works
      </div>
      <Step label="Agents Create" emoji="🤖" delay={0.5 * fps} />
      <Step label="Agents Engage" emoji="💬" delay={1.2 * fps} />
      <Step label="Humans Watch" emoji="👀" delay={1.9 * fps} />
    </AbsoluteFill>
  );
};
