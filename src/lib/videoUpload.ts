import { BlobRef, jsonToLex } from "@atproto/api";

export const VIDEO_SERVICE = "https://video.bsky.app";

/**
 * The pieces of the logged-in agent that a video upload needs. Kept small so
 * tests can supply a fake without a real atproto session.
 */
export type VideoUploadDeps = {
  /** The account's DID. */
  did: string;
  /** Service-auth token from com.atproto.server.getServiceAuth, scoped to the PDS's uploadBlob. */
  getServiceAuthToken: () => Promise<string>;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** How often to poll the processing job. */
  pollIntervalMs?: number;
  /** Give up waiting after this long. */
  timeoutMs?: number;
  log?: (...args: unknown[]) => void;
};

type JobStatus = {
  jobId: string;
  state: string;
  progress?: number;
  blob?: {
    $type?: "blob";
    ref: { $link: string };
    mimeType: string;
    size: number;
  };
  error?: string;
  message?: string;
  failureCode?: string;
};

/**
 * Upload an mp4 through Bluesky's video service so it gets transcoded to HLS.
 *
 * A raw `uploadBlob` to the PDS stores the file, but video.bsky.app never
 * processes it and the post shows an unplayable video. The service instead
 * transcodes the file, writes the result to the user's PDS as a blob, and
 * returns that blob for the post's embed.
 */
export async function uploadVideo(buffer: Uint8Array, name: string, deps: VideoUploadDeps): Promise<BlobRef> {
  const { did, getServiceAuthToken, fetch: doFetch = fetch, log = console.log } = deps;

  const token = await getServiceAuthToken();
  const url = new URL("/xrpc/app.bsky.video.uploadVideo", VIDEO_SERVICE);
  url.searchParams.set("did", did);
  url.searchParams.set("name", name);
  const res = await doFetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4" },
    body: buffer,
  });
  const body = (await res.json().catch(() => ({}))) as Partial<JobStatus> & {
    jobStatus?: JobStatus;
  };
  // Success returns { jobStatus }. Re-uploading an identical file returns 409
  // with the existing job's status at the top level, which is still usable.
  const status = body.jobStatus ?? (body.jobId ? (body as JobStatus) : undefined);
  if (!status || (!res.ok && res.status !== 409)) {
    throw new Error(`Video upload failed (${res.status}): ${body.message ?? body.error ?? JSON.stringify(body)}`);
  }
  log(`Video job ${status.jobId}: ${status.state}`);

  const done = await waitForJob(status, deps);
  const ref = jsonToLex({ $type: "blob", ...done.blob });
  if (!(ref instanceof BlobRef)) throw new Error(`Unexpected blob from video service: ${JSON.stringify(done.blob)}`);
  return ref;
}

/** Poll getJobStatus until the job has a blob, fails, or times out. */
async function waitForJob(
  initial: JobStatus,
  deps: VideoUploadDeps,
): Promise<JobStatus & { blob: NonNullable<JobStatus["blob"]> }> {
  const {
    fetch: doFetch = fetch,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    pollIntervalMs = 2000,
    timeoutMs = 10 * 60_000,
    log = console.log,
  } = deps;
  const deadline = Date.now() + timeoutMs;
  let status = initial;
  while (!status.blob) {
    if (status.state === "JOB_STATE_FAILED") {
      const why = [status.failureCode, status.error, status.message].filter(Boolean).join(" ");
      throw new Error(`Video processing failed: ${why}`);
    }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for video job ${status.jobId} (${status.state})`);
    await sleep(pollIntervalMs);
    const statusUrl = new URL("/xrpc/app.bsky.video.getJobStatus", VIDEO_SERVICE);
    statusUrl.searchParams.set("jobId", status.jobId);
    const poll = await doFetch(statusUrl);
    if (!poll.ok) throw new Error(`getJobStatus failed (${poll.status}): ${await poll.text()}`);
    const prev = status.state;
    status = ((await poll.json()) as { jobStatus: JobStatus }).jobStatus;
    if (status.state !== prev) log(`Video job ${status.jobId}: ${status.state}`);
  }
  return status as JobStatus & { blob: NonNullable<JobStatus["blob"]> };
}
