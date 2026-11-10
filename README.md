# Bluesky wombot 🦋

[wombatmylove on bluesky](https://bsky.app/profile/wombatmylove.bsky.social)

Bot based on a [template repo for building Bluesky bots that post on their own schedule](https://github.com/philnash/bsky-bot). It uses [TypeScript](https://www.typescriptlang.org/) to build the bot and [GitHub Actions](https://docs.github.com/en/actions) to schedule the posts.

When run, it picks a random image or `.mp4` video from `/img` that isn't listed in `img/image_list.txt`, posts it (images are rescaled to fit Bluesky's 1MB limit; videos are uploaded as-is, up to 300MB), and only then appends the filename to the list. Alt text is the filename minus its extension.

**Video length isn't checked.** Only the 300MB size limit is enforced. Bluesky also caps video duration, but there's no official published number (third-party sources cite 3–10 minutes), so keep clips short. A too-long video will make that day's post fail.

As a safety net against a lost record (e.g. the post succeeded but committing the list failed), it also checks the account's last 100 posts and skips — and back-fills into the list — anything whose alt text is already on Bluesky. If nothing unposted is left, the run fails with a clear error so GitHub emails you.

## Adding new images

0. Setup python env: `source .venv/bin/activate` / `pip install -r /path/to/requirements.txt` / etc.
1. Add images (or `.mp4` videos — labeling these needs `ffmpeg`) to the `/img_staging` directory
2. Export `ANTHROPIC_API_KEY`, then run `python labeler.py` to rename the images with Claude-generated alt text
3. Move the images to the `/img` directory

## Running locally

`npm run build`
`npm start`

Set `DRY_RUN=1` to log in and pick an item without posting or recording anything, e.g. `npm run build && DRY_RUN=1 npm run dev` (reads `.env`).

## Tests

`npm test` (vitest). Run one file with `npx vitest run test/run.test.ts`, or one test with `-t "<name>"`.

## Scheduling

The schedule is controlled by the GitHub Actions workflow in [./.github/workflows/post.yml](./.github/workflows/post.yml). The [schedule trigger](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) uses cron syntax to schedule when the workflow runs and your bot posts. [Crontab Guru](https://crontab.guru/) is a good way to visualise it.

For example, the following YAML will schedule your bot to post at 5:30 and 17:30 every day.

```yml
on:
  schedule:
    - cron: "30 5,17 * * *"
```

Be warned that many GitHub Actions jobs are scheduled to happen on the hour, so that is a busy time and may see your workflow run later than expected or be dropped entirely.
