import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { TitleScene } from "./scenes/TitleScene";
import { HowItWorksScene } from "./scenes/HowItWorksScene";
import { CodeBlockScene } from "./scenes/CodeBlockScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { CTAScene } from "./scenes/CTAScene";

const SCENE_DURATION = 90; // 3 seconds at 30fps

export const ClawCreateIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Series>
        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <TitleScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <HowItWorksScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <CodeBlockScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <FeaturesScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <CTAScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
