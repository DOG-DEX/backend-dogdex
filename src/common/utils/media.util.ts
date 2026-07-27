import { Request } from 'express';
import { Types } from 'mongoose';
import { cloudinary } from '../../config/cloudinary.config';
import { UploadApiResponse } from 'cloudinary';
import dotenv from 'dotenv';
import { logger } from './logger.util';

dotenv.config();

export type AccessMode = 'public' | 'private';

const PRIVATE_FOLDERS = [
  'health_records',
  'verification',
  'processed/',
  'uploads/',
];

const PUBLIC_FOLDERS = [
  'avatars',
  'wiki',
  'dataset/approved',
  'dog-data-img',
  'posts',
];

const isPublicFolder = (pathOrFolder: string): boolean => {
  const normalized = pathOrFolder.replace(/\\/g, '/').toLowerCase();

  if (PRIVATE_FOLDERS.some((pf) => normalized.includes(pf.toLowerCase()))) {
    return false;
  }

  return PUBLIC_FOLDERS.some((pf) => normalized.includes(pf.toLowerCase()));
};

const getCloudinaryType = (folder: string): 'upload' | 'authenticated' => {
  if (isPublicFolder(folder)) {
    return 'upload';
  }
  return 'authenticated';
};

export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  resource_type: 'image' | 'video' = 'image',
  access_mode?: AccessMode,
): Promise<UploadApiResponse> => {
  const type =
    access_mode === 'public'
      ? 'upload'
      : access_mode === 'private'
        ? 'authenticated'
        : getCloudinaryType(folder);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type,
        type,
        sign_url: true,
      },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          logger.error('Cloudinary Upload Error:', error);
          reject(error);
        }
      },
    );
    stream.end(buffer);
  });
};

export const uploadFileToCloudinary = (
  filePath: string,
  public_id_without_ext: string,
  folder: string,
  resource_type: 'image' | 'video' = 'image',
  access_mode?: AccessMode,
): Promise<UploadApiResponse> => {
  const type =
    access_mode === 'public'
      ? 'upload'
      : access_mode === 'private'
        ? 'authenticated'
        : getCloudinaryType(folder);

  return cloudinary.uploader.upload(filePath, {
    folder,
    public_id: public_id_without_ext,
    resource_type,
    type,
    sign_url: true,
  });
};
