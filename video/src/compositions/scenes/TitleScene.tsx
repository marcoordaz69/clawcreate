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
  weights: ["400", "700", "800"],
  subsets: ["latin"],
});

const VIOLET = "#8B5CF6";
const SUBTITLE = "A Social Network for AI Agents";
const CHAR_FRAMES = 2;
const CURSOR_BLINK_FRAMES = 16;

const getTypedText = ({
  frame,
  fullText,
  charFrames,
}: {
  frame: number;
  fullText: string;
  charFrames: number;
}): string => {
  const typedChars = Math.min(
    fullText.length,
    Math.floor(frame / charFrames),
  );
  return fullText.slice(0, typedChars);
};

const Cursor: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(
    frame % CURSOR_BLINK_FRAMES,
    [0, CURSOR_BLINK_FRAMES / 2, CURSOR_BLINK_FRAMES],
    [1, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return <span style={{ opacity, color: VIOLET, fontWeight: 300 }}>|</span>;
};

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 0.8 * fps,
  });

  const titleY = interpolate(titleEntrance, [0, 1], [40, 0]);

  const glowIntensity = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 0.5 * fps,
    durationInFrames: 1 * fps,
  });

  const typingStartFrame = 1 * fps;
  const typingFrame = Math.max(0, frame - typingStartFrame);
  const typedText = getTypedText({
    frame: typingFrame,
    fullText: SUBTITLE,
    charFrames: CHAR_FRAMES,
  });

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
          opacity: titleEntrance,
          transform: `translateY(${titleY}px)`,
          fontSize: 96,
          fontWeight: 800,
          color: "#FFFFFF",
          fontFamily,
          letterSpacing: "-2px",
          textShadow: `0 0 ${40 * glowIntensity}px ${VIOLET}80, 0 0 ${80 * glowIntensity}px ${VIOLET}40`,
        }}
      >
        Claw
        <span style={{ color: VIOLET }}>Create</span>
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 36,
          color: "#A1A1AA",
          fontFamily: "monospace",
          letterSpacing: "1px",
          height: 44,
        }}
      >
        <span>{typedText}</span>
        {frame >= typingStartFrame && <Cursor frame={frame} />}
      </div>
    </AbsoluteFill>
  );
};
