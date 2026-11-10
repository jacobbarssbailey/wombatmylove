import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { readPosted, recordPosted } from "../src/lib/postedLog.js";
import { makeTmpDir } from "./helpers.js";

describe("posted log", () => {
  let listPath: string;
  beforeEach(() => {
    listPath = path.join(makeTmpDir(), "image_list.txt");
  });

  it("treats a missing file as nothing posted", () => {
    expect(readPosted(listPath).size).toBe(0);
  });

  it("ignores blank lines, CRLF endings and surrounding whitespace", () => {
    fs.writeFileSync(listPath, "a.jpg\r\n\r\n  b.jpg  \nc.jpg");
    expect([...readPosted(listPath)].sort()).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("normalizes unicode so NFD and NFC names match", () => {
    const nfd = "café wombat.jpg";
    fs.writeFileSync(listPath, nfd + "\n");
    expect(readPosted(listPath).has("café wombat.jpg")).toBe(true);
  });

  it("creates the file when recording the first entry", () => {
    recordPosted(listPath, "a.jpg");
    expect(fs.readFileSync(listPath, "utf-8")).toBe("a.jpg\n");
  });

  it("does not glue onto a last line that lacks a trailing newline", () => {
    fs.writeFileSync(listPath, "a.jpg");
    recordPosted(listPath, "b.jpg");
    expect(fs.readFileSync(listPath, "utf-8")).toBe("a.jpg\nb.jpg\n");
    expect(readPosted(listPath).has("b.jpg")).toBe(true);
  });

  it("does not record the same name twice", () => {
    recordPosted(listPath, "a.jpg");
    recordPosted(listPath, "a.jpg");
    expect(fs.readFileSync(listPath, "utf-8")).toBe("a.jpg\n");
  });
});
