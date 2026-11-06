import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Verify the actual file emitted by the original HyperFrames renderer.
export function verifyVideo(videoPath, reportDir) {
  const video = resolve(videoPath);
  const metadata = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_streams', '-show_format', '-of', 'json', video,
  ], { encoding: 'utf8', timeout: 30_000 }));
  const picture = metadata.streams.find(s => s.codec_type === 'video');
  const sound = metadata.streams.find(s => s.codec_type === 'audio');
  const duration = Number(metadata.format.duration);
  if (!picture || picture.width !== 1080 || picture.height !== 1920 || picture.codec_name !== 'h264') {
    throw new Error('Expected an actual 1080x1920 H.264 video from HyperFrames.');
  }
  if (!sound || sound.codec_name !== 'aac' || !Number.isFinite(duration) || duration < 5 || duration > 180) {
    throw new Error('Expected AAC narration and a video between 5 and 180 seconds.');
  }
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', video, '-f', 'null', '-'], { timeout: 180_000 });
  // FFmpeg writes filter diagnostics to stderr; use spawnSync to capture both streams.
  return { video, metadata, picture, sound, duration, reportDir: resolve(reportDir) };
}

export async function inspectVideo(videoPath, reportDir) {
  const { spawnSync } = await import('node:child_process');
  const result = verifyVideo(videoPath, reportDir);
  const volume = spawnSync('ffmpeg', ['-hide_banner', '-i', result.video, '-vn', '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8', timeout: 180_000 });
  const mean = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(volume.stderr || '')?.[1]);
  if (volume.status !== 0 || !Number.isFinite(mean) || mean < -50) {
    throw new Error('Rendered MP4 has missing/silent narration or audio decoding failed.');
  }
  mkdirSync(result.reportDir, { recursive: true });
  const hashes = [];
  for (const [index, fraction] of [0.1, 0.5, 0.85].entries()) {
    const position = (result.duration * fraction).toFixed(3);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', position, '-i', result.video, '-frames:v', '1',
      join(result.reportDir, `frame-${index + 1}.png`)], { timeout: 60_000 });
    const hash = execFileSync('ffmpeg', ['-v', 'error', '-ss', position, '-i', result.video, '-frames:v', '1',
      '-an', '-f', 'framemd5', '-'], { encoding: 'utf8', timeout: 60_000 });
    hashes.push(hash.trim().split('\n').at(-1).split(',').at(-1).trim());
  }
  if (new Set(hashes).size < 2) throw new Error('Sampled frames are identical; inspect the HyperFrames/GSAP render.');
  const report = {
    width: result.picture.width, height: result.picture.height, duration: result.duration,
    videoCodec: result.picture.codec_name, audioCodec: result.sound.codec_name,
    meanVolumeDb: mean, sampledFrameHashes: hashes, fullyDecoded: true,
  };
  writeFileSync(join(result.reportDir, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  inspectVideo(process.argv[2], process.argv[3] || 'output/verification').catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
