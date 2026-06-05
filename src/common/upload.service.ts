import { put } from '@vercel/blob';
import { BadRequestException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';

export const imageUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Solo se permiten imagenes'), false);
      return;
    }
    cb(null, true);
  },
};

export async function saveImage(file: Express.Multer.File | undefined, folder: string): Promise<string | null> {
  if (!file) return null;

  const extension = extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${folder}/${randomUUID()}${extension}`;
  const blobStoreId = process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN_STORE_ID;

  if (process.env.BLOB_READ_WRITE_TOKEN || blobStoreId) {
    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
      storeId: blobStoreId,
    });
    return blob.url;
  }

  const target = join(process.cwd(), 'uploads', folder);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, filename.replace(`${folder}/`, '')), file.buffer);
  return `/uploads/${filename}`;
}
