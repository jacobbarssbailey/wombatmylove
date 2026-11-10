import * as fs from "node:fs";
import * as path from "node:path";
import { normalizeName } from "./postedLog.js";

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
export const VIDEO_EXTENSIONS = [".mp4"];
export const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

export function isVideo(file: string): boolean {
  return VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase());
}

/** Postable image/video files in `dir` whose names are not in `posted`. */
export function listCandidates(dir: string, posted: Set<string>): string[] {
  return fs
    .readdirSync(dir)
    .filter((file) => MEDIA_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .filter((file) => !posted.has(normalizeName(file)));
}

/** Fisher–Yates shuffle (non-mutating). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The filename (minus its final extension) is the alt text. */
export function altTextFromPath(filePath: string): string {
  return normalizeName(path.basename(filePath).replace(/\.[^.]+$/, "")).replace("credit ", "credit: ");
}
