import { describe, expect, it } from "vitest";
import { uploadVideo } from "../src/lib/videoUpload.js";

const CID = "bafkreiede4r4wpt4cok7onhfur34ew5zajbl445a5lkqnampsnmbzc6zlm";
const blob = {
  $type: "blob",
  ref: { $link: CID },
  mimeType: "video/mp4",
  size: 123,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Fake fetch: first call is the upload, the rest are getJobStatus polls. */
function fakeFetch(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return next;
  }) as typeof fetch;
  return { fn, calls };
}

const base = {
  did: "did:plc:abc",
  getServiceAuthToken: async () => "tok",
  sleep: async () => {},
  log: () => {},
};

describe("uploadVideo", () => {
  it("uploads to the video service and polls until the blob is ready", async () => {
    const { fn, calls } = fakeFetch([
      json(200, {
        jobStatus: {
          jobId: "j1",
          did: "did:plc:abc",
          state: "JOB_STATE_CREATED",
        },
      }),
      json(200, {
        jobStatus: {
          jobId: "j1",
          did: "did:plc:abc",
          state: "JOB_STATE_ENCODING",
        },
      }),
      json(200, {
        jobStatus: {
          jobId: "j1",
          did: "did:plc:abc",
          state: "JOB_STATE_COMPLETED",
          blob,
        },
      }),
    ]);

    const ref = await uploadVideo(new Uint8Array([1, 2, 3]), "w.mp4", {
      ...base,
      fetch: fn,
    });

    expect(ref.ref.toString()).toBe(CID);
    expect(ref.mimeType).toBe("video/mp4");
    const upload = new URL(calls[0].url);
    expect(upload.origin + upload.pathname).toBe("https://video.bsky.app/xrpc/app.bsky.video.uploadVideo");
    expect(upload.searchParams.get("did")).toBe("did:plc:abc");
    expect(upload.searchParams.get("name")).toBe("w.mp4");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(calls.slice(1).every((c) => c.url.includes("getJobStatus?jobId=j1"))).toBe(true);
  });

  it("reuses the existing job when the video was already uploaded (409)", async () => {
    const { fn } = fakeFetch([
      json(409, {
        jobId: "j2",
        did: "did:plc:abc",
        state: "JOB_STATE_COMPLETED",
        error: "already_exists",
        blob,
      }),
    ]);
    const ref = await uploadVideo(new Uint8Array([1]), "w.mp4", {
      ...base,
      fetch: fn,
    });
    expect(ref.ref.toString()).toBe(CID);
  });

  it("throws when processing fails", async () => {
    const { fn } = fakeFetch([
      json(200, {
        jobStatus: {
          jobId: "j3",
          did: "did:plc:abc",
          state: "JOB_STATE_CREATED",
        },
      }),
      json(200, {
        jobStatus: {
          jobId: "j3",
          did: "did:plc:abc",
          state: "JOB_STATE_FAILED",
          failureCode: "encoding_failure",
        },
      }),
    ]);
    await expect(uploadVideo(new Uint8Array([1]), "w.mp4", { ...base, fetch: fn })).rejects.toThrow(/encoding_failure/);
  });

  it("throws on an upload error such as auth failure", async () => {
    const { fn } = fakeFetch([json(401, { error: "AuthMissing", message: "bad token" })]);
    await expect(uploadVideo(new Uint8Array([1]), "w.mp4", { ...base, fetch: fn })).rejects.toThrow(/401.*bad token/);
  });

  it("times out if the job never finishes", async () => {
    const pending = () =>
      json(200, {
        jobStatus: {
          jobId: "j4",
          did: "did:plc:abc",
          state: "JOB_STATE_ENCODING",
        },
      });
    const { fn } = fakeFetch([pending(), pending(), pending()]);
    await expect(
      uploadVideo(new Uint8Array([1]), "w.mp4", {
        ...base,
        fetch: fn,
        timeoutMs: -1,
      }),
    ).rejects.toThrow(/Timed out/);
  });
});
