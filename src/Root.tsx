import React from "react";
import { Composition } from "remotion";
import "./theme";
import { Video } from "./Video";
import { FPS, TOTAL } from "./ritmo";

// Teaser de B&N Lectures en tres formatos: 4:5 (feed), 16:9 (YouTube) y 9:16 (TikTok y Reels).
// Cada formato tiene su propia disposición (src/disposicion.ts); la duración sale del mapa de ritmo.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Clase" component={Video} durationInFrames={TOTAL} fps={FPS} width={1080} height={1350} />
    <Composition id="ClaseYT" component={Video} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="ClaseTT" component={Video} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);
