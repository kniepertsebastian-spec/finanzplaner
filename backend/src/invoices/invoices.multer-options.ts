import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';

export const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? './uploads/invoices');

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);

export const invoiceMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      mkdirSync(UPLOADS_DIR, { recursive: true });
      callback(null, UPLOADS_DIR);
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new BadRequestException('Nicht unterstützter Dateityp (nur PDF, JPEG, PNG, HEIC)'), false);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
};
