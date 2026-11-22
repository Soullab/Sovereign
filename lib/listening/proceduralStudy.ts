// LISTEN-01 · Procedural studies played by the one persistent player (2026-11-17 founder ruling, review-only).
//
// A procedural study is original sound generated in the browser by code, with no recorded media, so the Sound Studio
// media allowlist is untouched. It never opens its own AudioContext or output: the persistent player creates the
// context, holds the single output lease, owns the level, Pause, Stop and the dock, and hands the study a
// destination node. The study builds its graph into that node and returns a handle the player disposes on Stop.
//
// Pure types only: no DOM, no React, no network.

export type ProceduralStudyAPI = {
  /** The study has finished by itself. The player pauses, releases the output and never restarts it. */
  ended: (message: string) => void;
};

export type ProceduralStudyHandle = {
  /** Stop every source and timer the study owns. Called once, on Stop or when another sound replaces it. */
  dispose: () => void;
};

export type ProceduralStudy = {
  /** Stable id: playing the same id again resumes the running study instead of rebuilding it. */
  id: string;
  title: string;
  subtitle: string;
  /** Shown in the dock while it plays. */
  message: string;
  build: (context: AudioContext, destination: AudioNode, api: ProceduralStudyAPI) => ProceduralStudyHandle;
};
