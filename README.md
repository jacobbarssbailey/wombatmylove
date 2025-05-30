# Bluesky wombot 🦋

[wombatmylove on bluesky](https://bsky.app/profile/wombatmylove.bsky.social)

Bot based on a [template repo for building Bluesky bots that post on their own schedule](https://github.com/philnash/bsky-bot). It uses [TypeScript](https://www.typescriptlang.org/) to build the bot and [GitHub Actions](https://docs.github.com/en/actions) to schedule the posts.

When run, it selects a random wombat image from `/img` until it finds one that hasn't been posted. It then reads and rescales it to fit into Bluesky's 1MB blob limit, posts it, and records it as posted to avoid duplicates. Alt text is set to the filename of the image.

## Adding new images

0. Setup python env: `source .venv/bin/activate` / `pip install -r /path/to/requirements.txt` / etc.
1. Add images to the `/img_staging` directory
2. Run `python labeler.py` to rename the images with chatgpt-generate alt text
3. Move the images to the `/img` directory

## Running locally

`npm run build`
`npm start`

## Scheduling

The schedule is controlled by the GitHub Actions workflow in [./.github/workflows/post.yml](./.github/workflows/post.yml). The [schedule trigger](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) uses cron syntax to schedule when the workflow runs and your bot posts. [Crontab Guru](https://crontab.guru/) is a good way to visualise it.

For example, the following YAML will schedule your bot to post at 5:30 and 17:30 every day.

```yml
on:
  schedule:
    - cron: "30 5,17 * * *"
```

Be warned that many GitHub Actions jobs are scheduled to happen on the hour, so that is a busy time and may see your workflow run later than expected or be dropped entirely.
