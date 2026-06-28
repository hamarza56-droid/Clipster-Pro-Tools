import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import path from "path";
import fs from "fs";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

/**
 * Probe a video file for its dimensions and duration.
 */
export function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const videoStream = data.streams.find((s) => s.codec_type === "video");
      if (!videoStream) return reject(new Error("No video stream found in file"));
      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: parseFloat(data.format.duration),
      });
    });
  });
}

/**
 * Build the ffmpeg filter graph for the "zoomed out / letterboxed" effect:
 * the original reel is scaled down and centered on a 1080x1920 canvas,
 * with the surrounding space filled by a background layer.
 *
 * backgroundType: 'color' | 'blur' | 'image' | 'video'
 * backgroundValue:
 *   - color: hex string e.g. "#1a1a1a"
 *   - blur: (no value needed — uses a blurred/scaled copy of the source clip itself)
 *   - image: path to a background image file
 *   - video: path to a background video file (looped if shorter than the clip)
 *
 * scalePercent: how much to shrink the original clip on the canvas (e.g. 80 = 80% of canvas height)
 */
export async function applyBackgroundSwap({
  inputPath,
  outputPath,
  backgroundType = "color",
  backgroundValue = "#0a0a0a",
  scalePercent = 80,
}) {
  const { width, height, duration } = await probeVideo(inputPath);

  // Target size of the foreground clip on the canvas, preserving aspect ratio,
  // constrained to scalePercent of canvas height.
  const targetHeight = Math.round((CANVAS_HEIGHT * scalePercent) / 100);
  const targetWidth = Math.round((targetHeight * width) / height);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    command.outputOptions(["-filter_threads", "1"]);
    let filterComplex;

    if (backgroundType === "blur") {
      // Background = same clip, scaled to fill canvas and heavily blurred.
      command.input(inputPath);
      filterComplex = [
        `[0:v]scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:force_original_aspect_ratio=increase,crop=${CANVAS_WIDTH}:${CANVAS_HEIGHT},gblur=sigma=30[bg]`,
        `[0:v]scale=${targetWidth}:${targetHeight}[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]`,
      ].join(";");
      command
        .complexFilter(filterComplex, "outv")
        .outputOptions(["-map 0:a?"]);
    } else if (backgroundType === "image") {
      if (!backgroundValue || !fs.existsSync(backgroundValue)) {
        return reject(new Error("Background image path is missing or invalid"));
      }
      command.input(inputPath);
      command.input(backgroundValue);
      // The extra leading scale=2160:-1 caps the decoded working resolution
      // of the background image before the canvas-fill scale/crop — without
      // it, ffmpeg can decode a very large source photo at full resolution
      // first, which is the main driver of OOM crashes on memory-constrained
      // hosts.
      filterComplex = [
        `[1:v]scale=2160:-1,scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:force_original_aspect_ratio=increase,crop=${CANVAS_WIDTH}:${CANVAS_HEIGHT}[bg]`,
        `[0:v]scale=${targetWidth}:${targetHeight}[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]`,
      ].join(";");
      command
        .complexFilter(filterComplex, "outv")
        .outputOptions(["-map 0:a?"]);
    } else if (backgroundType === "video") {
      if (!backgroundValue || !fs.existsSync(backgroundValue)) {
        return reject(new Error("Background video path is missing or invalid"));
      }
      command.input(inputPath);
      command.input(backgroundValue).inputOptions(["-stream_loop", "-1"]);
      filterComplex = [
        `[1:v]scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}:force_original_aspect_ratio=increase,crop=${CANVAS_WIDTH}:${CANVAS_HEIGHT}[bg]`,
        `[0:v]scale=${targetWidth}:${targetHeight}[fg]`,
        `[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1[outv]`,
      ].join(";");
      command
        .complexFilter(filterComplex, "outv")
        .outputOptions(["-map 0:a?"]);
    } else {
      // Solid color background (default)
      command.input(inputPath);
      command.input(`color=c=${backgroundValue.replace("#", "0x")}:s=${CANVAS_WIDTH}x${CANVAS_HEIGHT}:d=${duration}`)
        .inputFormat("lavfi");
      filterComplex = [
        `[0:v]scale=${targetWidth}:${targetHeight}[fg]`,
        `[1:v][fg]overlay=(W-w)/2:(H-h)/2[outv]`,
      ].join(";");
      command
        .complexFilter(filterComplex, "outv")
        .outputOptions(["-map 0:a?"]);
    }

    command
      .outputOptions([
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        "-threads", "1",
      ])
      .on("start", (cmd) => console.log("[ffmpeg] start:", cmd))
      .on("error", (err) => reject(err))
      .on("end", () => resolve(outputPath))
      .save(outputPath);
  });
}

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
