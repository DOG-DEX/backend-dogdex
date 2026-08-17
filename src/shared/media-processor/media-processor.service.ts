import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { spawnSync } from 'child_process';
import fs from 'fs';
import { logger } from '../../common/utils/logger.util';

const MAX_IMAGE_DIMENSION = 1024;
const VIDEO_PREPROCESS_ENABLED = process.env.VIDEO_PREPROCESS_ENABLED !== '0';
const VIDEO_PREPROCESS_BITRATE = process.env.VIDEO_PREPROCESS_BITRATE || '500k';
const VIDEO_PREPROCESS_PRESET =
  process.env.VIDEO_PREPROCESS_PRESET || 'ultrafast';
const VIDEO_TARGET_BITRATE = process.env.VIDEO_TARGET_BITRATE || '2000k';

@Injectable()
export class MediaProcessorService {
  private ffmpegAvailable = false;

  constructor() {
    this.initFfmpeg();
  }

  private initFfmpeg(): void {
    try {
      const ffmpegLib = require('fluent-ffmpeg');
      const ffmpegPath = this.probeFfmpeg();
      if (ffmpegPath) {
        ffmpegLib.setFfmpegPath(ffmpegPath);
        this.ffmpegAvailable = true;
        logger.info('[MediaProcessor] ffmpeg configured.');
      } else {
        logger.warn(
          '[MediaProcessor] ffmpeg not found. Video optimization disabled.',
        );
      }
      try {
        const probe = require('@ffprobe-installer/ffprobe');
        if (probe?.path) ffmpegLib.setFfprobePath(probe.path);
      } catch {
        try {
          const probeStatic = require('ffprobe-static');
          if (probeStatic?.path) ffmpegLib.setFfprobePath(probeStatic.path);
        } catch {
          /* no ffprobe */
        }
      }
    } catch {
      logger.warn(
        '[MediaProcessor] fluent-ffmpeg not installed. Video optimization disabled.',
      );
    }
  }

  private probeFfmpeg(): string | null {
    const envPath = process.env.FFMPEG_PATH || process.env.FFMPEG;
    if (envPath) {
      try {
        if (spawnSync(envPath, ['-version']).status === 0) return envPath;
      } catch {
        /* continue */
      }
    }
    try {
      if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
    } catch {
      /* continue */
    }
    try {
      const inst = require('@ffmpeg-installer/ffmpeg');
      if (inst?.path) return inst.path;
    } catch {
      /* continue */
    }
    try {
      const staticF = require('ffmpeg-static');
      if (staticF) return staticF;
    } catch {
      /* continue */
    }
    return null;
  }

  /** Resize and compress an image file to a Buffer */
  async optimizeImage(filePath: string): Promise<Buffer> {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    if (
      (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
      (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)
    ) {
      image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    return image.jpeg({ quality: 85 }).toBuffer();
  }

  /** Optimize a video file using ffmpeg, falls back to raw read if unavailable */
  async optimizeVideo(filePath: string): Promise<Buffer> {
    if (process.env.SKIP_VIDEO_OPTIMIZATION === '1') {
      logger.warn(
        '[MediaProcessor] SKIP_VIDEO_OPTIMIZATION — returning raw buffer',
      );
      return fs.promises.readFile(filePath);
    }

    if (!this.ffmpegAvailable) {
      logger.warn(
        '[MediaProcessor] ffmpeg not available, returning raw buffer.',
      );
      return fs.promises.readFile(filePath);
    }

    const ffmpeg = require('fluent-ffmpeg');

    const runFfmpeg = (command: any): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const out = command.pipe();
        out.on('data', (c: Buffer) => chunks.push(c));
        command.on('end', () => resolve(Buffer.concat(chunks)));
        command.on('error', reject);
      });

    try {
      if (!VIDEO_PREPROCESS_ENABLED) {
        return await runFfmpeg(
          ffmpeg(filePath)
            .videoBitrate(VIDEO_TARGET_BITRATE)
            .withVideoCodec('libx264')
            .addOption('-preset', 'fast')
            .addOption('-movflags', 'frag_keyframe+empty_moov')
            .outputFormat('mp4'),
        );
      }
      return await runFfmpeg(
        ffmpeg(filePath)
          .withVideoCodec('libx264')
          .videoBitrate(VIDEO_PREPROCESS_BITRATE)
          .addOption('-preset', VIDEO_PREPROCESS_PRESET)
          .format('mp4'),
      );
    } catch (err: any) {
      logger.warn(
        `[MediaProcessor] FFmpeg failed (${err.message}). Falling back to raw.`,
      );
      return fs.promises.readFile(filePath);
    }
  }
}
