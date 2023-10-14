# Bluesky wombot 🦋

Bot based on a template repo for building [Bluesky](https://bsky.app/) bots that post on their own schedule. It uses [TypeScript](https://www.typescriptlang.org/) to build the bot and [GitHub Actions](https://docs.github.com/en/actions) to schedule the posts.

* [How to use](#how-to-use)
  * [Things you will need](#things-you-will-need)
    * [A Bluesky account](#a-bluesky-account)
    * [Node.js](#nodejs)
  * [Create a new repository from this template](#create-a-new-repository-from-this-template)
  * [Running locally to test](#running-locally-to-test)
  * [Create your own posts](#create-your-own-posts)
  * [Deploy](#deploy)
    * [Schedule](#schedule)
    * [Environment variables](#environment-variables)
  * [Set it live](#set-it-live)


## How to use

To run this bot locally on your own machine you will need [Node.js](https://nodejs.org/en) version 18.16.0.

#### Schedule

The schedule is controlled by the GitHub Actions workflow in [./.github/workflows/post.yml](./.github/workflows/post.yml). The [schedule trigger](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule) uses cron syntax to schedule when the workflow runs and your bot posts. [Crontab Guru](https://crontab.guru/) is a good way to visualise it.

For example, the following YAML will schedule your bot to post at 5:30 and 17:30 every day.

```yml
on:
  schedule:
    - cron: "30 5,17 * * *"
```

Be warned that many GitHub Actions jobs are scheduled to happen on the hour, so that is a busy time and may see your workflow run later than expected or be dropped entirely.
