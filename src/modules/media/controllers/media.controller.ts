import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';

import { MediaService } from '../services/media.service';
import { DirectoryService } from '../services/directory.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { mediaUploadOptions } from '../../../common/config/upload.config';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger.util';
import * as path from 'path';
import * as fs from 'fs/promises';

@ApiTags('Media')
@Controller('api/medias')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly directoryService: DirectoryService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload single media file' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
    @Body('directory_id') directoryId?: string,
    @Body('type') type = 'image',
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng cung cấp tệp tải lên.');
    }

    let mediaPath = file.filename || file.path;

    // Check if Cloudinary is configured
    if (process.env.CLOUD_NAME_CLOUDINARY || process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const publicId = path.parse(file.filename || file.originalname).name;
        const uploadRes = await this.cloudinaryService.uploadFile(
          file.path,
          publicId,
          'uploads',
          type === 'video' ? 'video' : 'image',
          'public',
        );
        if (uploadRes && uploadRes.secure_url) {
          mediaPath = uploadRes.secure_url;
          // Delete temp file from local disk after successful upload
          await fs.unlink(file.path).catch(() => {});
        }
      } catch (err: any) {
        logger.warn('[MediaController] Cloudinary upload failed, falling back to local file:', err.message);
      }
    }

    const media = await this.mediaService.createMedia({
      name: file.originalname,
      mediaPath,
      type,
      creator_id: userId,
      directory_id: directoryId || null,
      file_size: file.size,
    });
    return { message: 'Tải lên phương tiện thành công', media };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10, mediaUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple media files' })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('userId') userId: string,
    @Body('directory_id') directoryId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 tệp.');
    }

    const uploaded = await Promise.all(
      files.map(async (file) => {
        let mediaPath = file.filename || file.path;
        const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

        if (process.env.CLOUD_NAME_CLOUDINARY || process.env.CLOUDINARY_CLOUD_NAME) {
          try {
            const publicId = path.parse(file.filename || file.originalname).name;
            const uploadRes = await this.cloudinaryService.uploadFile(
              file.path,
              publicId,
              'uploads',
              fileType === 'video' ? 'video' : 'image',
              'public',
            );
            if (uploadRes && uploadRes.secure_url) {
              mediaPath = uploadRes.secure_url;
              // Delete temp file from local disk after successful upload
              await fs.unlink(file.path).catch(() => {});
            }
          } catch (err: any) {
            logger.warn('[MediaController] Cloudinary upload failed for batch item, falling back to local file:', err.message);
          }
        }

        return this.mediaService.createMedia({
          name: file.originalname,
          mediaPath,
          type: fileType,
          creator_id: userId,
          directory_id: directoryId || null,
          file_size: file.size,
        });
      }),
    );

    return {
      message: `Đã tải lên ${uploaded.length} tệp thành công`,
      medias: uploaded,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List media files with filter and pagination' })
  async getMedias(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('directory_id') directoryId?: string,
  ) {
    return this.mediaService.findAndPaginate(userId, {
      page,
      limit,
      search,
      type,
      directory_id: directoryId,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/move')
  @ApiOperation({ summary: 'Move media file to another directory' })
  async moveMedia(
    @CurrentUser('userId') userId: string,
    @Param('id') mediaId: string,
    @Body('newDirectoryId') newDirectoryId: string | null,
  ) {
    const updated = await this.mediaService.moveMedia(
      mediaId,
      userId,
      newDirectoryId,
    );
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tệp phương tiện.');
    }
    return { message: 'Đã chuyển vị trí tệp thành công', media: updated };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete media file' })
  async deleteMedia(
    @Param('id') mediaId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const deleted = await this.mediaService.softDeleteMedia(mediaId, userId);
    if (!deleted) {
      throw new NotFoundException('Không tìm thấy tệp phương tiện để xóa.');
    }
    return { message: 'Xóa tệp phương tiện thành công' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DIRECTORY ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('directories')
  @ApiOperation({ summary: 'Create new directory folder' })
  async createDirectory(
    @CurrentUser('userId') userId: string,
    @Body('name') name: string,
    @Body('parent_id') parentId?: string,
  ) {
    if (!name) {
      throw new BadRequestException('Tên thư mục không được để trống.');
    }
    return this.directoryService.create(
      { name, parent_id: parentId || null },
      userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('directories')
  @ApiOperation({ summary: 'Get directory folders for user' })
  async getDirectories(
    @CurrentUser('userId') userId: string,
    @Query('parent_id') parentId?: string,
  ) {
    return this.directoryService.getChildren(userId, parentId || null);
  }
}
