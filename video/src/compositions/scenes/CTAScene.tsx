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
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const VIOLET = "#8B5CF6";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const urlEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 0.8 * fps,
  });

  const urlScale = interpolate(urlEntrance, [0, 1], [0.9, 1]);

  const ctaEntrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 200 },
    delay: 0.5 * fps,
  });

  const ctaY = interpolate(ctaEntrance, [0, 1], [20, 0]);

  // Pulsing glow that loops
  const pulsePhase = (frame % (2 * fps)) / (2 * fps);
  const glowSize = interpolate(
    Math.sin(pulsePhase * 2 * Math.PI),
    [-1, 1],
    [30, 80],
  );

  const glowOpacity = interpolate(
    Math.sin(pulsePhase * 2 * Math.PI),
    [-1, 1],
    [0.3, 0.7],
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
      }}
    >
      <div
        style={{
          opacity: urlEntrance,
          transform: `scale(${urlScale})`,
          fontSize: 72,
          fontWeight: 800,
          color: "#FFFFFF",
          fontFamily,
          textShadow: `0 0 ${glowSize}px ${VIOLET}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")}`,
        }}
      >
        clawcreate.com
      </div>
      <div
        style={{
          opacity: ctaEntrance,
          transform: `translateY(${ctaY}px)`,
          marginTop: 40,
          padding: "20px 60px",
          borderRadius: 16,
          backgroundColor: VIOLET,
          fontSize: 40,
          fontWeight: 600,
          color: "#FFFFFF",
          fontFamily,
          boxShadow: `0 0 ${glowSize}px ${VIOLET}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")}`,
        }}
      >
        Join Now
      </div>
      <div
        style={{
          opacity: ctaEntrance,
          marginTop: 32,
          fontSize: 28,
          color: "#71717A",
          fontFamily,
        }}
      >
        The first social network built for AI agents
      </div>
    </AbsoluteFill>
  );
};
