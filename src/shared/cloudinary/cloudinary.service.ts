import { Injectable } from '@nestjs/common';
import { v2 as cloudinaryClient, UploadApiResponse } from 'cloudinary';
import { logger } from '../../utils/logger.util';

export type AccessMode = 'public' | 'private';

const PRIVATE_FOLDERS = ['health_records', 'verification', 'processed/', 'uploads/'];
const PUBLIC_FOLDERS = ['avatars', 'wiki', 'dataset/approved', 'dog-data-img', 'posts'];

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinaryClient.config({
      cloud_name: process.env.CLOUD_NAME_CLOUDINARY,
      api_key: process.env.API_KEY_CLOUDINARY,
      api_secret: process.env.API_SECRET_CLOUDINARY,
    });
  }

  get client() {
    return cloudinaryClient;
  }

  isPublicFolder(pathOrFolder: string): boolean {
    const normalized = pathOrFolder.replace(/\\/g, '/').toLowerCase();
    if (PRIVATE_FOLDERS.some((pf) => normalized.includes(pf.toLowerCase()))) return false;
    return PUBLIC_FOLDERS.some((pf) => normalized.includes(pf.toLowerCase()));
  }

  getCloudinaryType(folder: string): 'upload' | 'authenticated' {
    return this.isPublicFolder(folder) ? 'upload' : 'authenticated';
  }

  /** Upload a Buffer to Cloudinary */
  uploadBuffer(
    buffer: Buffer,
    folder: string,
    resource_type: 'image' | 'video' = 'image',
    access_mode?: AccessMode,
  ): Promise<UploadApiResponse> {
    const type =
      access_mode === 'public' ? 'upload' :
      access_mode === 'private' ? 'authenticated' :
      this.getCloudinaryType(folder);

    return new Promise((resolve, reject) => {
      const stream = cloudinaryClient.uploader.upload_stream(
        { folder, resource_type, type, sign_url: true },
        (error, result) => {
          if (result) resolve(result);
          else {
            logger.error('Cloudinary Buffer Upload Error:', error);
            reject(error);
          }
        },
      );
      stream.end(buffer);
    });
  }

  /** Upload a file path to Cloudinary */
  uploadFile(
    filePath: string,
    publicId: string,
    folder: string,
    resource_type: 'image' | 'video' = 'image',
    access_mode?: AccessMode,
  ): Promise<UploadApiResponse> {
    const type =
      access_mode === 'public' ? 'upload' :
      access_mode === 'private' ? 'authenticated' :
      this.getCloudinaryType(folder);

    return cloudinaryClient.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      resource_type,
      type,
    });
  }

  /** Upload a base64 Data URI to Cloudinary */
  async uploadBase64(
    base64Data: string,
    folder: string,
    resource_type: 'image' | 'video' = 'image',
    access_mode?: AccessMode,
  ): Promise<string> {
    const dataUri = `data:${resource_type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
    const type =
      access_mode === 'public' ? 'upload' :
      access_mode === 'private' ? 'authenticated' : undefined;

    const uploadOptions: any = { folder, resource_type };
    if (type) uploadOptions.type = type;

    const result = await cloudinaryClient.uploader.upload(dataUri, uploadOptions);
    return `${result.public_id}.${result.format}`;
  }

  /** Generate a signed or public URL from a stored path */
  buildUrl(storedPath: string): string {
    if (!storedPath) return storedPath;
    if (storedPath.startsWith('http') || storedPath.startsWith('data:')) return storedPath;

    const CLOUD_NAME = process.env.CLOUD_NAME_CLOUDINARY;
    const normalized = storedPath.replace(/\\/g, '/').replace(/^\/+/, '');

    const isCloudinaryPath =
      normalized.startsWith('public/') ||
      normalized.startsWith('uploads/') ||
      normalized.startsWith('dataset/') ||
      normalized.startsWith('processed/') ||
      normalized.startsWith('dog-data-img/');

    if (!isCloudinaryPath || !CLOUD_NAME) return storedPath;

    const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];
    const isVideoFile = videoExtensions.some((ext) => normalized.toLowerCase().endsWith(ext));
    const resourceType = normalized.includes('/videos/') || isVideoFile ? 'video' : 'image';

    const publicId =
      resourceType === 'image'
        ? normalized.substring(0, normalized.lastIndexOf('.')) || normalized
        : normalized;

    const isPublic = this.isPublicFolder(normalized);

    try {
      if (!isPublic) {
        return cloudinaryClient.url(publicId, {
          resource_type: resourceType,
          type: 'authenticated',
          sign_url: true,
          secure: true,
        });
      }
      return cloudinaryClient.url(publicId, {
        resource_type: resourceType,
        type: 'upload',
        secure: true,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      });
    } catch {
      const typeStr = isPublic ? 'upload' : 'authenticated';
      return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/${typeStr}/${publicId}`;
    }
  }

  /** Move a Cloudinary asset to a new folder */
  async moveAsset(oldPublicId: string, newPublicId: string): Promise<void> {
    try {
      await cloudinaryClient.uploader.rename(oldPublicId, newPublicId, { overwrite: true });
    } catch (error: any) {
      if (error.http_code !== 422) throw error;
      logger.warn(`[Cloudinary] Destination '${newPublicId}' already exists.`);
    }
  }
}
