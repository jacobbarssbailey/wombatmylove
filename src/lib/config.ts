import { env } from "node:process";
import { z } from "zod";
import type { AtpAgentLoginOpts } from "@atproto/api";

const envSchema = z.object({
  BSKY_HANDLE: z.string().nonempty(),
  BSKY_PASSWORD: z.string().nonempty(),
  BSKY_SERVICE: z.string().nonempty().default("https://bsky.social"),
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export type Config = {
  account: AtpAgentLoginOpts;
  service: string;
  dryRun: boolean;
};

// Parsed lazily so modules can be imported (e.g. by tests) without credentials.
export function loadConfig(source: NodeJS.ProcessEnv = env): Config {
  const parsed = envSchema.parse(source);
  return {
    account: { identifier: parsed.BSKY_HANDLE, password: parsed.BSKY_PASSWORD },
    service: parsed.BSKY_SERVICE,
    dryRun: parsed.DRY_RUN,
  };
}
