import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const uploadDirectory = join(process.cwd(), 'public', 'uploads');
mkdirSync(uploadDirectory, { recursive: true });

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const storage = diskStorage({
  destination: uploadDirectory,
  filename: (_request, file, callback) =>
    callback(
      null,
      `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
    ),
});

function acceptMimeTypes(allowedMimeTypes: Set<string>) {
  return (
    _request: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new BadRequestException('Unsupported file type'), false);
      return;
    }
    callback(null, true);
  };
}

export const imageUploadOptions = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: acceptMimeTypes(imageMimeTypes),
};

export const mediaUploadOptions = {
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: acceptMimeTypes(new Set([...imageMimeTypes, ...videoMimeTypes])),
};
