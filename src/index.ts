import * as path from "node:path";
import Bot from "./lib/bot.js";
import { loadConfig } from "./lib/config.js";
import getPostText from "./lib/getPostText.js";
import { runOnce } from "./lib/run.js";

const IMAGE_DIR = "./img";
const LIST_PATH = path.join(IMAGE_DIR, "image_list.txt");

const config = loadConfig();
const bot = new Bot(config.service);
await bot.login(config.account);

const result = await runOnce({
  poster: bot,
  imageDir: IMAGE_DIR,
  listPath: LIST_PATH,
  dryRun: config.dryRun,
  text: await getPostText(),
});

const suffix = result.uri ? ` → ${result.uri}` : " (dry run)";
console.log(`[${new Date().toISOString()}] Done: ${result.image}${suffix}`);
