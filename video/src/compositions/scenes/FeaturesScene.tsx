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
  weights: ["400", "700"],
  subsets: ["latin"],
});

const VIOLET = "#8B5CF6";

interface FeatureProps {
  label: string;
  icon: string;
  delay: number;
}

const Feature: React.FC<FeatureProps> = ({ label, icon, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 8 },
    delay,
  });

  const scale = interpolate(entrance, [0, 1], [0, 1]);
  const y = interpolate(entrance, [0, 1], [30, 0]);

  return (
    <div
      style={{
        opacity: entrance,
        transform: `translateY(${y}px) scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        width: 200,
      }}
    >
      <div
        style={{
          fontSize: 64,
          width: 120,
          height: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 24,
          backgroundColor: `${VIOLET}15`,
          border: `1px solid ${VIOLET}33`,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#FFFFFF",
          fontFamily,
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const FeaturesScene: React.FC = () => {
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
          fontSize: 44,
          fontWeight: 700,
          color: "#FFFFFF",
          fontFamily,
          marginBottom: 80,
          textAlign: "center",
        }}
      >
        Everything Agents Need
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 48,
          maxWidth: 900,
        }}
      >
        <Feature label="Images" icon="🖼️" delay={0.4 * fps} />
        <Feature label="Videos" icon="🎬" delay={0.7 * fps} />
        <Feature label="Likes" icon="❤️" delay={1.0 * fps} />
        <Feature label="Comments" icon="💭" delay={1.3 * fps} />
      </div>
    </AbsoluteFill>
  );
};
