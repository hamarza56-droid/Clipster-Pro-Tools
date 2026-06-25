import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import JimpPkg from "jimp";
const Jimp = JimpPkg.Jimp || JimpPkg;import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Extract N evenly-spaced frames from a video to a directory as PNGs.
 */
export function extractFrames(inputPath, outputDir, frameCount = 6) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    ffmpeg(inputPath)
      .on("end", () => {
        const files = fs
          .readdirSync(outputDir)
          .filter((f) => f.endsWith(".png"))
          .map((f) => path.join(outputDir, f));
        resolve(files);
      })
      .on("error", reject)
      .screenshots({
        count: frameCount,
        folder: outputDir,
        filename: "frame-%i.png",
      });
  });
}

/**
 * Slide a reference logo image across a frame and return the best
 * normalized correlation score (0-1) found at any position/scale.
 * This is a simplified, CPU-cheap template match — good enough to flag
 * "logo likely present" rather than pixel-perfect computer vision.
 */
async function matchTemplateInFrame(frameImg, templateImg, scales = [0.5, 0.75, 1, 1.25, 1.5]) {
  let bestScore = 0;

  for (const scale of scales) {
    const tw = Math.round(templateImg.bitmap.width * scale);
    const th = Math.round(templateImg.bitmap.height * scale);
    if (tw < 8 || th < 8 || tw > frameImg.bitmap.width || th > frameImg.bitmap.height) continue;

    const resizedTemplate = templateImg.clone().resize({ w: tw, h: th });
    const stepX = Math.max(4, Math.floor(tw / 4));
    const stepY = Math.max(4, Math.floor(th / 4));

    for (let y = 0; y <= frameImg.bitmap.height - th; y += stepY) {
      for (let x = 0; x <= frameImg.bitmap.width - tw; x += stepX) {
        const score = compareRegion(frameImg, resizedTemplate, x, y);
        if (score > bestScore) bestScore = score;
      }
    }
  }

  return bestScore;
}

/**
 * Compare a region of the frame to the template using mean pixel similarity.
 * Returns a 0-1 similarity score (1 = identical).
 */
function compareRegion(frameImg, templateImg, offsetX, offsetY) {
  const { width: tw, height: th } = templateImg.bitmap;
  let totalDiff = 0;
  let samples = 0;

  // Sample a grid of points rather than every pixel, for speed.
  const sampleStep = Math.max(1, Math.floor(Math.min(tw, th) / 16));

  for (let ty = 0; ty < th; ty += sampleStep) {
    for (let tx = 0; tx < tw; tx += sampleStep) {
      const tColor = templateImg.getPixelColor(tx, ty);
      const fColor = frameImg.getPixelColor(offsetX + tx, offsetY + ty);

      const t = Jimp.intToRGBA(tColor);
      const f = Jimp.intToRGBA(fColor);

      const diff =
        Math.abs(t.r - f.r) + Math.abs(t.g - f.g) + Math.abs(t.b - f.b);
      totalDiff += diff;
      samples++;
    }
  }

  if (samples === 0) return 0;
  const avgDiff = totalDiff / samples / (255 * 3); // normalize 0-1, 0=identical
  return 1 - avgDiff;
}

/**
 * Run logo detection across a video by extracting frames and template-matching
 * a reference logo image against each. Returns { detected, confidence }.
 */
export async function detectLogoInVideo({
  videoPath,
  logoReferencePath,
  framesDir,
  confidenceThreshold = 0.78,
}) {
  const frames = await extractFrames(videoPath, framesDir, 6);
  const templateImg = await Jimp.read(logoReferencePath);

  let bestConfidence = 0;

  for (const framePath of frames) {
    const frameImg = await Jimp.read(framePath);
    const score = await matchTemplateInFrame(frameImg, templateImg);
    if (score > bestConfidence) bestConfidence = score;
  }

  // Clean up extracted frames
  for (const f of frames) {
    fs.unlinkSync(f);
  }

  return {
    detected: bestConfidence >= confidenceThreshold,
    confidence: Math.round(bestConfidence * 1000) / 1000,
  };
}
