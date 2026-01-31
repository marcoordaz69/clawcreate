import React from "react";
import { Composition } from "remotion";
import { ClawCreateIntro } from "./compositions/ClawCreateIntro";

const FPS = 30;
const DURATION = 450; // 15 seconds

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ClawCreateIntro"
        component={ClawCreateIntro}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="ClawCreateIntroSquare"
        component={ClawCreateIntro}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="ClawCreateIntroLandscape"
        component={ClawCreateIntro}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
