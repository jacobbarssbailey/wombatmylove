import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { runOnce, type Poster } from "../src/lib/run.js";
import { altTextFromPath } from "../src/lib/getImage.js";
import { makeTmpDir, makeImages } from "./helpers.js";

type FakePoster = Poster & { posted: string[] };

function fakePoster(opts: { recent?: string[]; failPost?: boolean; failFeed?: boolean } = {}): FakePoster {
  const posted: string[] = [];
  return {
    posted,
    async recentAltTexts() {
      if (opts.failFeed) throw new Error("feed down");
      return new Set([...(opts.recent ?? []), ...posted.map(altTextFromPath)]);
    },
    async postMedia(imagePath: string) {
      if (opts.failPost) throw new Error("upload failed");
      posted.push(imagePath);
      return { uri: `at://did:plc:test/app.bsky.feed.post/${posted.length}` };
    },
  };
}

const silent = () => undefined;

describe("select → post → record", () => {
  let dir: string;
  let listPath: string;
  const names = ["one.jpg", "two.jpg", "three.jpg"];

  beforeEach(async () => {
    dir = makeTmpDir();
    listPath = path.join(dir, "image_list.txt");
    await makeImages(dir, names);
  });

  const listed = () => (fs.existsSync(listPath) ? fs.readFileSync(listPath, "utf-8").split("\n").filter(Boolean) : []);

  it("posts an unposted image and records it afterwards", async () => {
    const poster = fakePoster();
    const result = await runOnce({ poster, imageDir: dir, listPath, log: silent });
    expect(poster.posted).toHaveLength(1);
    expect(result.image).toBe(poster.posted[0]);
    expect(listed()).toEqual([path.basename(poster.posted[0])]);
  });

  it("never picks an image that is already in the list", async () => {
    fs.writeFileSync(listPath, "one.jpg\nthree.jpg\n");
    for (let i = 0; i < 20; i++) {
      const poster = fakePoster();
      fs.writeFileSync(listPath, "one.jpg\nthree.jpg\n");
      await runOnce({ poster, imageDir: dir, listPath, log: silent, random: () => i / 20 });
      expect(path.basename(poster.posted[0])).toBe("two.jpg");
    }
  });

  it("posts every image exactly once across consecutive runs", async () => {
    const poster = fakePoster();
    for (let i = 0; i < names.length; i++) {
      await runOnce({ poster, imageDir: dir, listPath, log: silent });
    }
    expect(poster.posted.map((p) => path.basename(p)).sort()).toEqual([...names].sort());
    expect(listed().sort()).toEqual([...names].sort());
  });

  it("does not record anything when the post fails", async () => {
    const poster = fakePoster({ failPost: true });
    await expect(runOnce({ poster, imageDir: dir, listPath, log: silent })).rejects.toThrow("upload failed");
    expect(listed()).toEqual([]);
  });

  it("does not post or record on a dry run", async () => {
    const poster = fakePoster();
    const result = await runOnce({ poster, imageDir: dir, listPath, log: silent, dryRun: true });
    expect(result.image).toBeTruthy();
    expect(poster.posted).toEqual([]);
    expect(listed()).toEqual([]);
  });

  it("fails with a clear error instead of recursing forever when the pool is empty", async () => {
    fs.writeFileSync(listPath, names.join("\n") + "\n");
    const poster = fakePoster();
    await expect(runOnce({ poster, imageDir: dir, listPath, log: silent })).rejects.toThrow(/no unposted/i);
    expect(poster.posted).toEqual([]);
  });

  it("skips (and back-fills) an image already on Bluesky but missing from the list", async () => {
    // Simulates the Nov 4 2026 run: post succeeded, git push failed, record lost.
    const poster = fakePoster({ recent: ["one", "two"] });
    await runOnce({ poster, imageDir: dir, listPath, log: silent, random: () => 0 });
    expect(poster.posted.map((p) => path.basename(p))).toEqual(["three.jpg"]);
    expect(listed().sort()).toEqual(["one.jpg", "three.jpg", "two.jpg"]);
  });

  it("still posts when the feed check is unavailable", async () => {
    const poster = fakePoster({ failFeed: true });
    const log = vi.fn();
    await runOnce({ poster, imageDir: dir, listPath, log });
    expect(poster.posted).toHaveLength(1);
    expect(log.mock.calls.flat().join(" ")).toMatch(/feed/i);
  });

  it("errors when the only remaining images are already on Bluesky", async () => {
    fs.writeFileSync(listPath, "one.jpg\ntwo.jpg\n");
    const poster = fakePoster({ recent: ["three"] });
    await expect(runOnce({ poster, imageDir: dir, listPath, log: silent })).rejects.toThrow(/no unposted/i);
    expect(poster.posted).toEqual([]);
    expect(listed()).toContain("three.jpg");
  });
});
