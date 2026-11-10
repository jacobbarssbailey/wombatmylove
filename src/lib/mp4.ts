// Minimal MP4 (ISO BMFF) reader: just enough to get a video track's display
// dimensions (for Bluesky's aspectRatio) and the file's duration.

export type Mp4Info = { width: number; height: number; durationSeconds: number };

type Box = { type: string; start: number; end: number; body: number };

function* boxes(buf: Buffer, start: number, end: number): Generator<Box> {
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    let body = pos + 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(pos + 8));
      body = pos + 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < 8 || pos + size > end) return;
    yield { type, start: pos, end: pos + size, body };
    pos += size;
  }
}

function child(buf: Buffer, parent: Box, type: string): Box | undefined {
  for (const b of boxes(buf, parent.body, parent.end)) if (b.type === type) return b;
  return undefined;
}

function readTkhd(buf: Buffer, box: Box) {
  const version = buf.readUInt8(box.body);
  // version/flags, times, track id, reserved, duration, reserved(8), layer, group, volume, reserved
  const matrixAt = box.body + (version === 1 ? 4 + 8 + 8 + 4 + 4 + 8 : 4 + 4 + 4 + 4 + 4 + 4) + 8 + 8;
  const a = buf.readInt32BE(matrixAt) / 65536;
  const b = buf.readInt32BE(matrixAt + 4) / 65536;
  const width = buf.readUInt32BE(matrixAt + 36) / 65536;
  const height = buf.readUInt32BE(matrixAt + 40) / 65536;
  // A 90°/270° display rotation puts the weight in b rather than a.
  const rotated = Math.abs(b) > Math.abs(a);
  return rotated ? { width: height, height: width } : { width, height };
}

function readMvhdDuration(buf: Buffer, box: Box): number {
  const version = buf.readUInt8(box.body);
  if (version === 1) {
    const timescale = buf.readUInt32BE(box.body + 4 + 16);
    return Number(buf.readBigUInt64BE(box.body + 4 + 20)) / timescale;
  }
  const timescale = buf.readUInt32BE(box.body + 4 + 8);
  return buf.readUInt32BE(box.body + 4 + 12) / timescale;
}

export function readMp4Info(buf: Buffer): Mp4Info {
  const moov = [...boxes(buf, 0, buf.length)].find((b) => b.type === "moov");
  if (!moov) throw new Error("not an MP4 file (no moov box)");

  const mvhd = child(buf, moov, "mvhd");
  const durationSeconds = mvhd ? readMvhdDuration(buf, mvhd) : 0;

  for (const trak of boxes(buf, moov.body, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(buf, trak, "mdia");
    const hdlr = mdia && child(buf, mdia, "hdlr");
    if (!hdlr || buf.toString("latin1", hdlr.body + 8, hdlr.body + 12) !== "vide") continue;
    const tkhd = child(buf, trak, "tkhd");
    if (!tkhd) continue;
    const { width, height } = readTkhd(buf, tkhd);
    return { width: Math.round(width), height: Math.round(height), durationSeconds };
  }
  throw new Error("MP4 has no video track");
}
