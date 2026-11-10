import * as path from "node:path";
import { altTextFromPath, listCandidates, shuffle } from "./getImage.js";
import { readPosted, recordPosted } from "./postedLog.js";

/** The parts of the Bluesky client that the posting flow depends on. */
export interface Poster {
  /** Alt texts of images in the account's recent posts. */
  recentAltTexts(): Promise<Set<string>>;
  postMedia(mediaPath: string, text: string): Promise<{ uri: string }>;
}

export type RunOptions = {
  poster: Poster;
  imageDir: string;
  listPath: string;
  dryRun?: boolean;
  text?: string;
  random?: () => number;
  log?: (...args: unknown[]) => void;
};

export type RunResult = { image: string; uri?: string };

/**
 * Select an unposted image, post it, then record it.
 *
 * Recording happens only after the post succeeds. As a second line of defence
 * (e.g. when the post succeeded but committing the list back to git failed),
 * candidates whose alt text appears in the account's recent posts are skipped
 * and back-filled into the list.
 */
export async function runOnce(opts: RunOptions): Promise<RunResult> {
  const { poster, imageDir, listPath, dryRun = false, text = "", random = Math.random, log = console.log } = opts;

  const candidates = listCandidates(imageDir, readPosted(listPath));
  log(`${candidates.length} unposted image(s) in ${imageDir}`);

  let recent = new Set<string>();
  try {
    recent = await poster.recentAltTexts();
  } catch (err) {
    log(`Warning: could not check recent feed for duplicates (${String(err)}); relying on ${listPath} only`);
  }

  const eligible = candidates.filter((file) => {
    if (!recent.has(altTextFromPath(file))) return true;
    log(`Already on Bluesky but missing from list, back-filling: ${file}`);
    if (!dryRun) recordPosted(listPath, file);
    return false;
  });

  const [chosen] = shuffle(eligible, random);

  if (!chosen) {
    throw new Error(`No unposted images or videos left in ${imageDir}. Add more images (see README).`);
  }

  const image = path.join(imageDir, chosen);
  log("Selected image:", image);

  if (dryRun) {
    log("Dry run: not posting or recording");
    return { image };
  }

  const { uri } = await poster.postMedia(image, text);
  recordPosted(listPath, chosen);
  log("Posted:", uri);
  return { image, uri };
}
