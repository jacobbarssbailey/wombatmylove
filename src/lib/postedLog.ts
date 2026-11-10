import * as fs from "node:fs";

// The posted log is a plain text file: one filename per line, appended after
// each successful post. It's committed back to the repo by the GitHub Action.

export function normalizeName(name: string): string {
  return name.normalize("NFC").trim();
}

export function readPosted(listPath: string): Set<string> {
  if (!fs.existsSync(listPath)) return new Set();
  return new Set(
    fs
      .readFileSync(listPath, "utf-8")
      .split(/\r?\n/)
      .map(normalizeName)
      .filter(Boolean)
  );
}

export function recordPosted(listPath: string, filename: string): void {
  const name = normalizeName(filename);
  if (readPosted(listPath).has(name)) return;
  const existing = fs.existsSync(listPath) ? fs.readFileSync(listPath, "utf-8") : "";
  const sep = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  fs.appendFileSync(listPath, `${sep}${name}\n`);
}
