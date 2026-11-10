import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { listCandidates, altTextFromPath } from "../src/lib/getImage.js";
import { makeTmpDir } from "./helpers.js";

function touch(dir: string, names: string[]) {
  for (const n of names) fs.writeFileSync(path.join(dir, n), "");
}

describe("listCandidates", () => {
  it("only returns supported image/video files, never the list file", () => {
    const dir = makeTmpDir();
    touch(dir, ["a.jpg", "b.JPEG", "c.png", "d.webp", "e.mp4", "f.mov", "notes.txt", "image_list.txt", ".DS_Store"]);
    expect(listCandidates(dir, new Set()).sort()).toEqual(["a.jpg", "b.JPEG", "c.png", "e.mp4"]);
  });

  it("excludes posted names by exact match, not substring", () => {
    const dir = makeTmpDir();
    // The old implementation used listContent.includes(name), so having posted
    // "big wombat.jpg" wrongly blocked "wombat.jpg" forever.
    touch(dir, ["wombat.jpg", "big wombat.jpg"]);
    expect(listCandidates(dir, new Set(["big wombat.jpg"]))).toEqual(["wombat.jpg"]);
  });

  it("returns an empty list when everything is posted", () => {
    const dir = makeTmpDir();
    touch(dir, ["a.jpg"]);
    expect(listCandidates(dir, new Set(["a.jpg"]))).toEqual([]);
  });
});

describe("altTextFromPath", () => {
  it("strips directory and only the final extension", () => {
    expect(altTextFromPath("img/a wombat named st. clair.jpg")).toBe("a wombat named st. clair");
  });
  it("drops the ~N uniqueness suffix added by labeler.py", () => {
    expect(altTextFromPath("img/wombat in grass (credit: Jane)~2.jpg")).toBe("wombat in grass (credit: Jane)");
  });
  it("fixes legacy 'credit ' to 'credit: '", () => {
    expect(altTextFromPath("img/wombat (credit Jane).jpg")).toBe("wombat (credit: Jane)");
  });
});
