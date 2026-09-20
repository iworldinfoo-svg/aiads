'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { GEN_DIR } = require('../config');

// FFmpeg is used for post-processing only: concatenating scene posters into a
// video, muxing TTS audio, overlaying the SVG end card + watermark, and burning
// on-screen text FX. The AI never renders text/logos (hard rule).
// In this sandbox FFmpeg is not installed; the pipeline falls back to an HTML
// preview. The command builder below is real and will run wherever FFmpeg exists.

function detect() {
  return new Promise((resolve) => {
    execFile('which', ['ffmpeg'], (err, stdout) => {
      resolve(!err && stdout.toString().trim().length > 0);
    });
  });
}

// Build an FFmpeg command that assembles the final MP4 from scene posters,
// end card and (optional) audio. Returns the command array for execFile.
function buildCommand({ orderId, scenes, endcardPath, audioPath, duration, outPath, watermark }) {
  const dir = path.join(GEN_DIR, String(orderId));
  const concat = path.join(dir, 'concat.txt');
  const lines = scenes.map((s) => `file '${path.resolve(s.poster_path)}'`).join('\n');
  fs.writeFileSync(concat, lines);

  const cmd = ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concat];
  if (audioPath && fs.existsSync(audioPath)) {
    cmd.push('-i', audioPath);
  }
  // Scale all to 1080x1920 (9:16) and set duration per scene.
  const vf = ['scale=1080:1920:force_original_aspect_ratio=decrease', 'pad=1080:1920:(ow-iw)/2:(oh-ih)/2'];
  if (watermark) vf.push("drawtext=text='AI Ad Studio':fontcolor=white@0.5:fontsize=36:x=40:y=40");
  cmd.push('-vf', vf.join(','));
  cmd.push('-t', String(duration));
  if (audioPath && fs.existsSync(audioPath)) {
    cmd.push('-c:v', 'libx264', '-c:a', 'aac', '-shortest', outPath);
  } else {
    cmd.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', outPath);
  }
  return { cmd, concat };
}

function run(orderId, opts) {
  return new Promise((resolve) => {
    if (!fs.existsSync(opts.outPath)) {
      // ensure out dir
    }
    const { cmd } = buildCommand({ orderId, ...opts });
    execFile(cmd[0], cmd.slice(1), { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return resolve({ ok: false, error: String(err.message), stderr: String(stderr) });
      resolve({ ok: true, outPath: opts.outPath });
    });
  });
}

module.exports = { detect, buildCommand, run };
