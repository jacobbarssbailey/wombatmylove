# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Bluesky bot (`wombatmylove.bsky.social`) that posts one random wombat photo or video per day. Forked from the `philnash/bsky-bot` template. TypeScript (ESM, Node 24 per `.nvmrc`, `@atproto/api` `AtpAgent`) for the bot, plus Python helper scripts for curating media offline.

## Commands

```sh
npm run build                      # tsc -> dist/ (only src/ is compiled)
npm test                           # vitest
npx vitest run test/run.test.ts    # one file;  add -t "<test name>" for one test
npm run lint                       # eslint src/ (sonarjs rules are on)
npm start                          # node . — needs BSKY_HANDLE / BSKY_PASSWORD
DRY_RUN=1 npm run dev              # loads .env; logs in and selects but doesn't post or record
```

Python helpers (use `.venv`, `pip install -r requirements.txt`):
- `python labeler.py` renames every image/.mp4 in `img_staging/` to Claude-generated alt text. Videos are labeled from 3 ffmpeg-extracted frames, so ffmpeg must be installed locally.
- `python cleanup-posted-images.py` moves files listed in `img/image_list.txt` from `img/` to `img_posted/` and appends them to `img_posted/posted_images.txt`.

## How it works

**The filename is the data model.** Each file's name minus its extension is its alt text, e.g. `wombat on a log (credit: Jane Doe).jpg`. The name is also the dedupe key, so renaming a posted file makes it eligible again. An unlabeled file dropped into `img/` will be posted with its raw download name as alt text.

Media lifecycle: `img_staging/` (raw downloads) → `labeler.py` renames → moved by hand to `img/` (the posting pool) → posted and appended to `img/image_list.txt` → occasionally archived to `img_posted/` by `cleanup-posted-images.py`. `img_old/` is a legacy archive that no code reads.

Code path: `src/index.ts` (config + wiring) → `runOnce` in `src/lib/run.ts` (select → post → record) → `Bot` in `src/lib/bot.ts`, which implements the `Poster` interface over atproto. `runOnce` only depends on `Poster`, so tests use a fake poster with real temp dirs (`test/run.test.ts`).

Dedupe has two layers, both in `runOnce`:
1. **Exact-match** against `img/image_list.txt` (`src/lib/postedLog.ts`, NFC-normalized). The name is appended only *after* a successful post.
2. **Feed check:** candidates whose alt text appears in the account's last 100 posts are skipped and back-filled into the list. This covers runs where the post succeeded but the git push of the list failed (that happened on 2026-11-04).

Images are resized to 1280px JPEG (1MB blob limit). Videos must be `.mp4` (≤300MB per the lexicon) and are uploaded with `uploadBlob`, with `aspectRatio` read by the pure-JS MP4 parser in `src/lib/mp4.ts`, which handles rotated phone video. There is no ffmpeg in CI. Video *duration* is logged but not enforced: Bluesky has a length cap but no official published number (third-party sources say 3–10 min).

**State lives in git.** `.github/workflows/post.yml` (daily cron at 10:10 UTC, plus manual dispatch) runs the bot, then commits `img/image_list.txt` back to `main` (rebasing first). So `origin/main` gets one bot commit per day: pull before working. `ci.yml` runs lint/build/test on code changes.

`src/lib/getPostText.ts` is a template stub; posts have no text.
