import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  AtpAgentLoginOpts,
  AppBskyFeedPost,
  AppBskyEmbedImages,
  AppBskyEmbedVideo,
} from "@atproto/api";
import { AtpAgent, RichText } from "@atproto/api";
import sharp from "sharp";
import { altTextFromPath, isVideo } from "./getImage.js";
import { readMp4Info } from "./mp4.js";
import type { Poster } from "./run.js";

/** How many of the account's own recent posts to check for duplicates. */
const RECENT_POST_LIMIT = 100;
/** From the app.bsky.embed.video lexicon. */
const MAX_VIDEO_BYTES = 300_000_000;

type Embed = NonNullable<AppBskyFeedPost.Record["embed"]>;

export default class Bot implements Poster {
  #agent;

  constructor(service: string | URL) {
    this.#agent = new AtpAgent({ service });
  }

  login(loginOpts: AtpAgentLoginOpts) {
    return this.#agent.login(loginOpts);
  }

  async recentAltTexts(): Promise<Set<string>> {
    const actor = this.#agent.session?.did;
    if (!actor) throw new Error("not logged in");
    const { data } = await this.#agent.getAuthorFeed({ actor, limit: RECENT_POST_LIMIT });
    const alts = new Set<string>();
    const add = (alt?: string) => alt && alts.add(alt.normalize("NFC").trim());
    for (const item of data.feed) {
      const embed = (item.post.record as AppBskyFeedPost.Record).embed;
      if (embed?.$type === "app.bsky.embed.images") {
        (embed as AppBskyEmbedImages.Main).images.forEach((img) => add(img.alt));
      } else if (embed?.$type === "app.bsky.embed.video") {
        add((embed as AppBskyEmbedVideo.Main).alt);
      }
    }
    return alts;
  }

  async postMedia(mediaPath: string, text: string): Promise<{ uri: string }> {
    const record: Partial<AppBskyFeedPost.Record> & { text: string } = { text: "" };
    if (text) {
      const richText = new RichText({ text });
      await richText.detectFacets(this.#agent);
      record.text = richText.text;
      record.facets = richText.facets;
    }
    record.embed = isVideo(mediaPath) ? await this.#videoEmbed(mediaPath) : await this.#imageEmbed(mediaPath);
    return this.#agent.post(record);
  }

  async #imageEmbed(imagePath: string): Promise<Embed> {
    // Bluesky caps image blobs at ~1MB; 1280px JPEG keeps us comfortably under.
    const buffer = await sharp(imagePath).resize(1280).jpeg().toBuffer();
    const { data } = await this.#agent.uploadBlob(buffer, { encoding: "image/jpeg" });
    return {
      $type: "app.bsky.embed.images",
      images: [{ image: data.blob, alt: altTextFromPath(imagePath) }],
    };
  }

  async #videoEmbed(videoPath: string): Promise<Embed> {
    const buffer = await fs.readFile(videoPath);
    if (buffer.length > MAX_VIDEO_BYTES) {
      throw new Error(`${path.basename(videoPath)} is ${buffer.length} bytes; Bluesky's limit is ${MAX_VIDEO_BYTES}`);
    }
    const { width, height, durationSeconds } = readMp4Info(buffer);
    console.log(`Video: ${width}x${height}, ${durationSeconds.toFixed(1)}s, ${(buffer.length / 1e6).toFixed(1)}MB`);
    const { data } = await this.#agent.uploadBlob(buffer, { encoding: "video/mp4" });
    return {
      $type: "app.bsky.embed.video",
      video: data.blob,
      alt: altTextFromPath(videoPath),
      aspectRatio: { width, height },
    };
  }
}
