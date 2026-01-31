import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const VIOLET = "#8B5CF6";
const CURSOR_BLINK_FRAMES = 16;

const CODE_LINES = [
  '$ curl -X POST clawcreate.com/api/agents \\',
  '  -H "Authorization: Bearer $TOKEN" \\',
  "  -d '{",
  '    "name": "MoltBot",',
  '    "type": "creator",',
  '    "capabilities": ["image", "video"]',
  "  }'",
  "",
  '{ "id": "agent_01", "status": "active" }',
];

const CHAR_FRAMES = 1;

const getTypedCode = (frame: number): string[] => {
  const fullText = CODE_LINES.join("\n");
  const totalChars = Math.min(
    fullText.length,
    Math.floor(frame / CHAR_FRAMES),
  );
  const visible = fullText.slice(0, totalChars);
  return visible.split("\n");
};

export const CodeBlockScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerEntrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 0.4 * fps,
  });

  const containerScale = interpolate(containerEntrance, [0, 1], [0.95, 1]);

  const typingStart = Math.round(0.4 * fps);
  const typingFrame = Math.max(0, frame - typingStart);
  const visibleLines = getTypedCode(typingFrame);

  const cursorOpacity = interpolate(
    frame % CURSOR_BLINK_FRAMES,
    [0, CURSOR_BLINK_FRAMES / 2, CURSOR_BLINK_FRAMES],
    [1, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#000000",
        padding: 48,
      }}
    >
      <div
        style={{
          opacity: containerEntrance,
          transform: `scale(${containerScale})`,
          width: "100%",
          maxWidth: 960,
          borderRadius: 20,
          overflow: "hidden",
          border: `1px solid ${VIOLET}44`,
          boxShadow: `0 0 40px ${VIOLET}20`,
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 24px",
            backgroundColor: "#18181B",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#EF4444",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#EAB308",
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#22C55E",
            }}
          />
          <span
            style={{
              marginLeft: 12,
              fontSize: 18,
              color: "#71717A",
              fontFamily: "monospace",
            }}
          >
            terminal
          </span>
        </div>
        {/* Code area */}
        <div
          style={{
            padding: "28px 32px",
            backgroundColor: "#09090B",
            fontFamily: "monospace",
            fontSize: 24,
            lineHeight: 1.7,
            color: "#E4E4E7",
            whiteSpace: "pre",
            minHeight: 400,
          }}
        >
          {visibleLines.map((line, i) => (
            <div key={i}>
              {line.startsWith("$") ? (
                <>
                  <span style={{ color: "#22C55E" }}>$</span>
                  <span style={{ color: "#E4E4E7" }}>{line.slice(1)}</span>
                </>
              ) : line.startsWith("{") || line.startsWith("  }") ? (
                <span style={{ color: VIOLET }}>{line}</span>
              ) : (
                <span style={{ color: "#A1A1AA" }}>{line}</span>
              )}
              {i === visibleLines.length - 1 && (
                <span style={{ opacity: cursorOpacity, color: VIOLET }}>
                  █
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
