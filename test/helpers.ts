import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import sharp from "sharp";

export function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wombat-test-"));
}

export async function makeImages(dir: string, names: string[]): Promise<void> {
  for (const name of names) {
    await sharp({
      create: { width: 16, height: 16, channels: 3, background: "#7a5c3e" },
    })
      .jpeg()
      .toFile(path.join(dir, name));
  }
}
