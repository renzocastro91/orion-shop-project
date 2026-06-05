import { put } from '@vercel/blob';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
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

function firstEnvValue(predicate: (name: string, value: string) => boolean): string | undefined {
  for (const [name, value] of Object.entries(process.env)) {
    const cleanValue = value?.trim();
    if (cleanValue && predicate(name, cleanValue)) {
      return cleanValue;
    }
  }
  return undefined;
}

export async function saveImage(file: Express.Multer.File | undefined, folder: string): Promise<string | null> {
  if (!file) return null;

  const extension = extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${folder}/${randomUUID()}${extension}`;
  const blobToken =
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ??
    firstEnvValue((name, value) => name.startsWith('BLOB_READ_WRITE_TOKEN') && value.startsWith('vercel_blob_rw_'));
  const blobStoreId =
    process.env.BLOB_STORE_ID?.trim() ??
    firstEnvValue((name, value) => name.endsWith('STORE_ID') && value.startsWith('store_'));

  if (blobToken || blobStoreId) {
    try {
      const blob = await put(filename, file.buffer, {
        access: 'public',
        contentType: file.mimetype,
        ...(blobToken ? { token: blobToken } : {}),
        ...(blobStoreId && !blobToken ? { storeId: blobStoreId } : {}),
      });
      return blob.url;
    } catch (error) {
      console.error('Vercel Blob upload failed', {
        folder,
        filename,
        hasBlobToken: Boolean(blobToken),
        hasBlobStoreId: Boolean(blobStoreId),
        error: error instanceof Error ? error.message : error,
      });
      throw new ServiceUnavailableException('No se pudo subir la imagen a Vercel Blob');
    }
  }

  const target = join(process.cwd(), 'uploads', folder);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, filename.replace(`${folder}/`, '')), file.buffer);
  return `/uploads/${filename}`;
}
