import { bskyAccount, bskyService } from "./config.js";
import type {
  AtpAgentLoginOpts,
  AtpAgentOpts,
  AppBskyFeedPost,
  AppBskyEmbedImages,
} from "@atproto/api";
import atproto from "@atproto/api";
const { BskyAgent, RichText } = atproto;
import type { Post } from './types.js';
import sharp from 'sharp';
import { getImage } from './getImage.js';

const IMAGE_PATH = "./img/wombat.jpg"

type BotOptions = {
  service: string | URL;
  dryRun: boolean;
};

export default class Bot {
  #agent;

  static defaultOptions: BotOptions = {
    service: bskyService,
    dryRun: false,
  } as const;

  constructor(service: AtpAgentOpts["service"]) {
    this.#agent = new BskyAgent({ service });
  }

  login(loginOpts: AtpAgentLoginOpts) {
    return this.#agent.login(loginOpts);
  }
  
  // post image
  async post(post: Post) {
    const payload: Partial<AppBskyFeedPost.Record> = {
      $type: 'app.bsky.feed.post',
      text: ''
    };
    if (post.text) {
      const richText = new RichText({ text: post.text });
      await richText.detectFacets(this.#agent);

      payload.text = richText.text;
      payload.facets = richText.facets;
    }
    if (post.pathList) {
      const embed: AppBskyEmbedImages.Main = {
        $type: 'app.bsky.embed.images',
        images: []
      };

      for (const imagePath of post.pathList) {
        const imageBuffer = await sharp(imagePath).resize(1280).toFormat('jpg').toBuffer();
        const uploaded = await this.#agent.uploadBlob(imageBuffer, {
          encoding: 'image/jpg'
        });

        const altText = (imagePath.split('/').pop() ?? '').split('.')[0];

        embed.images.push({
          image: uploaded.data.blob,
          alt: altText
        });
      }
      payload.embed = embed;
    }

    return this.#agent.post(payload);
  }


  static async run(
    getPostText: () => Promise<string>,
    botOptions?: Partial<BotOptions>
  ) {
    const { service, dryRun } = botOptions
      ? Object.assign({}, this.defaultOptions, botOptions)
      : this.defaultOptions;
    const bot = new Bot(service);
    await bot.login(bskyAccount);
    const text = await getPostText();
    const image = getImage();
    if (image) {
      console.log('Selected image:', image);
    } else {
      console.log('No image files found in the directory.');
    }
    if (image) {
      const p : Post = {
        text: text,
        pathList: [image]
      }
      if (!dryRun) {
        await bot.post(p);
      }
    }
    return text;
  }
}
