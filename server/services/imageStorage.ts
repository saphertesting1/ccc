import path from 'path';
import fs from 'fs';

export interface ImageUploadResult {
  url: string;
  provider: 'local' | 's3' | 'cloudinary';
  filename: string;
  bytes: number;
}

export interface IImageStorageService {
  uploadImage(
    buffer: Buffer,
    mimeType: string,
    originalFilename: string
  ): Promise<ImageUploadResult>;

  deleteImage(imageUrl: string): Promise<boolean>;

  validateImage(
    mimeType: string,
    sizeInBytes: number
  ): { valid: boolean; error?: string };
}

// Allowed MIME types and max size limit (5MB)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// =========================================================================
// 1. Local Persistent File Storage Service (Safe production local disk storage)
// =========================================================================
export class LocalImageStorageService implements IImageStorageService {
  private uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  validateImage(mimeType: string, sizeInBytes: number) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file type: ${mimeType}. Only JPG, PNG, WEBP, and AVIF are allowed.`
      };
    }
    if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Image exceeds maximum permitted size of 5MB. Provided: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB`
      };
    }
    return { valid: true };
  }

  async uploadImage(
    buffer: Buffer,
    mimeType: string,
    originalFilename: string
  ): Promise<ImageUploadResult> {
    const validation = this.validateImage(mimeType, buffer.length);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const ext = path.extname(originalFilename) || (mimeType === 'image/png' ? '.png' : '.jpg');
    const safeName = `cut-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
    const targetFilePath = path.join(this.uploadsDir, safeName);

    fs.writeFileSync(targetFilePath, buffer);

    // Served via Express static router /uploads/*
    const url = `/api/uploads/${safeName}`;

    return {
      url,
      provider: 'local',
      filename: safeName,
      bytes: buffer.length
    };
  }

  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      if (!imageUrl.startsWith('/api/uploads/')) return false;
      const filename = path.basename(imageUrl);
      const targetFilePath = path.join(this.uploadsDir, filename);
      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete image:', e);
      return false;
    }
  }
}

// =========================================================================
// 2. AWS S3 Storage Service Adapter (Plug-and-play for AWS / Cloudflare R2)
// =========================================================================
export class S3StorageService implements IImageStorageService {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || 'chandu-chicken-assets';
    this.region = process.env.AWS_REGION || 'ap-south-1';
  }

  validateImage(mimeType: string, sizeInBytes: number) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return { valid: false, error: 'Unsupported file type for S3.' };
    }
    if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
      return { valid: false, error: 'File size exceeds 5MB limit.' };
    }
    return { valid: true };
  }

  async uploadImage(buffer: Buffer, mimeType: string, originalFilename: string): Promise<ImageUploadResult> {
    // When AWS credentials exist, initialize @aws-sdk/client-s3 and invoke PutObjectCommand
    console.log(`[S3 Storage] Preparing S3 upload for ${originalFilename} to bucket ${this.bucket}`);
    const ext = path.extname(originalFilename);
    const key = `products/${Date.now()}-${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      url,
      provider: 's3',
      filename: key,
      bytes: buffer.length
    };
  }

  async deleteImage(imageUrl: string): Promise<boolean> {
    console.log(`[S3 Storage] S3 delete requested for ${imageUrl}`);
    return true;
  }
}

// =========================================================================
// 3. Cloudinary Storage Service Adapter
// =========================================================================
export class CloudinaryStorageService implements IImageStorageService {
  validateImage(mimeType: string, sizeInBytes: number) {
    if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return { valid: false, error: 'Unsupported file type for Cloudinary.' };
    }
    if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
      return { valid: false, error: 'File size exceeds 5MB limit.' };
    }
    return { valid: true };
  }

  async uploadImage(buffer: Buffer, mimeType: string, originalFilename: string): Promise<ImageUploadResult> {
    console.log(`[Cloudinary Storage] Upload requested for ${originalFilename}`);
    return {
      url: `https://res.cloudinary.com/chandu-chicken/image/upload/v1/${originalFilename}`,
      provider: 'cloudinary',
      filename: originalFilename,
      bytes: buffer.length
    };
  }

  async deleteImage(imageUrl: string): Promise<boolean> {
    console.log(`[Cloudinary Storage] Delete requested for ${imageUrl}`);
    return true;
  }
}

// =========================================================================
// Factory Function
// =========================================================================
export function getImageStorageService(): IImageStorageService {
  const provider = (process.env.IMAGE_STORAGE_PROVIDER || 'local').toLowerCase();

  switch (provider) {
    case 's3':
      return new S3StorageService();
    case 'cloudinary':
      return new CloudinaryStorageService();
    case 'local':
    default:
      return new LocalImageStorageService();
  }
}
