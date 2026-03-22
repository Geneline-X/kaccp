/**
 * Trims leading and trailing silence from PCM WAV audio files.
 * Zero external dependencies — uses raw WAV header parsing.
 */

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

function parseWav(buf: Buffer): WavInfo {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a valid WAV file');
  }

  let offset = 12;
  let sampleRate = 0, channels = 0, bitsPerSample = 0;
  let dataOffset = -1, dataLength = 0;

  while (offset < buf.length - 8) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);

    if (id === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataLength = size;
      break;
    }

    offset += 8 + size + (size % 2); // word-align
  }

  if (dataOffset === -1) throw new Error('No data chunk found in WAV file');
  return { sampleRate, channels, bitsPerSample, dataOffset, dataLength };
}

function buildWav(original: Buffer, dataOffset: number, pcmData: Buffer): Buffer {
  const header = Buffer.from(original.slice(0, dataOffset));
  // Update RIFF file size (total file size - 8 bytes for "RIFF" + size field itself)
  header.writeUInt32LE(dataOffset - 8 + pcmData.length, 4);
  // Update data chunk size (4 bytes before dataOffset)
  header.writeUInt32LE(pcmData.length, dataOffset - 4);
  return Buffer.concat([header, pcmData]);
}

function windowRms(
  buf: Buffer,
  dataOffset: number,
  bytesPerFrame: number,
  bitsPerSample: number,
  startFrame: number,
  endFrame: number,
): number {
  let sumSq = 0;
  for (let f = startFrame; f < endFrame; f++) {
    const off = dataOffset + f * bytesPerFrame;
    let s: number;
    if (bitsPerSample === 16) {
      s = buf.readInt16LE(off) / 32768;
    } else if (bitsPerSample === 32) {
      s = buf.readInt32LE(off) / 2147483648;
    } else {
      // 8-bit WAV is unsigned, centered at 128
      s = (buf.readUInt8(off) - 128) / 128;
    }
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / (endFrame - startFrame));
}

export interface TrimResult {
  buffer: Buffer;
  originalDurationSec: number;
  trimmedDurationSec: number;
  removedSec: number;
  wasModified: boolean;
}

/**
 * Trims leading AND trailing silence from a WAV buffer.
 *
 * @param wavBuf          Raw WAV file bytes
 * @param thresholdDb     Silence threshold in dBFS (default -40)
 * @param minRemoveSec    Minimum total silence to remove before acting (default 0.3s)
 * @param tailPaddingSec  Padding kept after the last detected sound (default 0.15s)
 * @param headPaddingSec  Padding kept before the first detected sound (default 0.05s)
 */
export function trimTrailingSilence(
  wavBuf: Buffer,
  thresholdDb = -40,
  minRemoveSec = 0.3,
  tailPaddingSec = 0.15,
  headPaddingSec = 0.05,
): TrimResult {
  const { sampleRate, channels, bitsPerSample, dataOffset, dataLength } = parseWav(wavBuf);
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * channels;
  const totalFrames = Math.floor(dataLength / bytesPerFrame);
  const originalDurationSec = totalFrames / sampleRate;

  const threshold = Math.pow(10, thresholdDb / 20); // dBFS → linear amplitude
  const windowFrames = Math.ceil(0.02 * sampleRate); // 20ms windows

  // ── Scan forward: find first audible frame (leading silence) ──────────────
  let firstSoundFrame = totalFrames; // default: all silent
  for (let base = 0; base + windowFrames <= totalFrames; base += windowFrames) {
    const end = Math.min(base + windowFrames, totalFrames);
    if (windowRms(wavBuf, dataOffset, bytesPerFrame, bitsPerSample, base, end) > threshold) {
      firstSoundFrame = base;
      break;
    }
  }

  const headPaddingFrames = Math.ceil(headPaddingSec * sampleRate);
  const startFrame = Math.max(0, firstSoundFrame - headPaddingFrames);

  // ── Scan backward: find last audible frame (trailing silence) ─────────────
  let lastSoundFrame = totalFrames;
  for (let base = totalFrames - windowFrames; base >= 0; base -= windowFrames) {
    const end = Math.min(base + windowFrames, totalFrames);
    if (windowRms(wavBuf, dataOffset, bytesPerFrame, bitsPerSample, base, end) > threshold) {
      lastSoundFrame = end;
      break;
    }
  }

  const tailPaddingFrames = Math.ceil(tailPaddingSec * sampleRate);
  const endFrame = Math.min(lastSoundFrame + tailPaddingFrames, totalFrames);

  const leadingRemovedSec = startFrame / sampleRate;
  const trailingRemovedSec = (totalFrames - endFrame) / sampleRate;
  const totalRemovedSec = leadingRemovedSec + trailingRemovedSec;

  if (totalRemovedSec < minRemoveSec) {
    return {
      buffer: wavBuf,
      originalDurationSec,
      trimmedDurationSec: originalDurationSec,
      removedSec: 0,
      wasModified: false,
    };
  }

  const pcmData = wavBuf.slice(
    dataOffset + startFrame * bytesPerFrame,
    dataOffset + endFrame * bytesPerFrame,
  );
  const newBuf = buildWav(wavBuf, dataOffset, pcmData);
  const keepFrames = endFrame - startFrame;
  const trimmedDurationSec = keepFrames / sampleRate;

  return {
    buffer: newBuf,
    originalDurationSec,
    trimmedDurationSec,
    removedSec: totalRemovedSec,
    wasModified: true,
  };
}
