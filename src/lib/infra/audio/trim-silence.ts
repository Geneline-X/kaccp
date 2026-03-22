/**
 * Trims trailing silence from PCM WAV audio files.
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

export interface TrimResult {
  buffer: Buffer;
  originalDurationSec: number;
  trimmedDurationSec: number;
  removedSec: number;
  wasModified: boolean;
}

/**
 * Trims trailing silence from a WAV buffer.
 *
 * @param wavBuf         Raw WAV file bytes
 * @param thresholdDb    Silence threshold in dBFS (default -40)
 * @param minRemoveSec   Minimum silence to remove before acting (default 0.5s)
 * @param tailPaddingSec Silence padding kept after the last detected sound (default 0.15s)
 */
export function trimTrailingSilence(
  wavBuf: Buffer,
  thresholdDb = -40,
  minRemoveSec = 0.5,
  tailPaddingSec = 0.15,
): TrimResult {
  const { sampleRate, channels, bitsPerSample, dataOffset, dataLength } = parseWav(wavBuf);
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * channels;
  const totalFrames = Math.floor(dataLength / bytesPerFrame);
  const originalDurationSec = totalFrames / sampleRate;

  const threshold = Math.pow(10, thresholdDb / 20); // dBFS → linear amplitude

  // Scan backwards in 20ms windows to find the last frame with audible sound
  const windowFrames = Math.ceil(0.02 * sampleRate);
  let lastSoundFrame = totalFrames;

  for (let base = totalFrames - windowFrames; base >= 0; base -= windowFrames) {
    const end = Math.min(base + windowFrames, totalFrames);
    let sumSq = 0;

    for (let f = base; f < end; f++) {
      const off = dataOffset + f * bytesPerFrame;
      let s: number;
      if (bitsPerSample === 16) {
        s = wavBuf.readInt16LE(off) / 32768;
      } else if (bitsPerSample === 32) {
        s = wavBuf.readInt32LE(off) / 2147483648;
      } else {
        // 8-bit WAV is unsigned, centered at 128
        s = (wavBuf.readUInt8(off) - 128) / 128;
      }
      sumSq += s * s;
    }

    const rms = Math.sqrt(sumSq / (end - base));
    if (rms > threshold) {
      lastSoundFrame = end;
      break;
    }
  }

  const paddingFrames = Math.ceil(tailPaddingSec * sampleRate);
  const keepFrames = Math.min(lastSoundFrame + paddingFrames, totalFrames);
  const removedSec = (totalFrames - keepFrames) / sampleRate;

  if (removedSec < minRemoveSec) {
    return {
      buffer: wavBuf,
      originalDurationSec,
      trimmedDurationSec: originalDurationSec,
      removedSec: 0,
      wasModified: false,
    };
  }

  const pcmData = wavBuf.slice(dataOffset, dataOffset + keepFrames * bytesPerFrame);
  const newBuf = buildWav(wavBuf, dataOffset, pcmData);
  const trimmedDurationSec = keepFrames / sampleRate;

  return {
    buffer: newBuf,
    originalDurationSec,
    trimmedDurationSec,
    removedSec,
    wasModified: true,
  };
}
