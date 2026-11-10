import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { readMp4Info } from "../src/lib/mp4.js";

const fixture = (name: string) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

describe("readMp4Info", () => {
  it("reads dimensions and duration", () => {
    const info = readMp4Info(fixture("landscape.mp4"));
    expect(info).toMatchObject({ width: 64, height: 36 });
    expect(info.durationSeconds).toBeCloseTo(1, 1);
  });

  it("swaps dimensions for a 90° rotated (phone) video", () => {
    expect(readMp4Info(fixture("rotated.mp4"))).toMatchObject({ width: 36, height: 64 });
  });

  it("rejects non-MP4 data", () => {
    expect(() => readMp4Info(Buffer.from("definitely not a video"))).toThrow(/not an MP4/);
  });
});
