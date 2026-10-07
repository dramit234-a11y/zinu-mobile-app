import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ErrorCode, MAX_UPLOAD_BYTES, type PresignedUploadDto } from '@zinu/shared';
import { and, count, eq, gte } from 'drizzle-orm';
import { AppError, notFound } from '../common/errors.js';
import { uuidv7 } from '../common/ids.js';
import { DB, type Db } from '../db/db.module.js';
import { uploads } from '../db/schema.js';
import { StorageService } from '../storage/storage.service.js';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};
const UPLOAD_URL_TTL_SEC = 600;
const DOWNLOAD_URL_TTL_SEC = 300;
const MAX_UPLOADS_PER_HOUR = 60;

@Injectable()
export class UploadsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  async presign(ownerId: string, purpose: string, contentType: string): Promise<PresignedUploadDto> {
    const [recent] = await this.db
      .select({ n: count() })
      .from(uploads)
      .where(and(eq(uploads.ownerId, ownerId), gte(uploads.createdAt, new Date(Date.now() - 3_600_000))));
    if ((recent?.n ?? 0) >= MAX_UPLOADS_PER_HOUR)
      throw new AppError(ErrorCode.RATE_LIMITED, 'Too many uploads. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);

    const id = uuidv7();
    // Keys are unguessable and grouped by owner; the bucket is private, so knowing a key grants nothing.
    const storageKey = `drivers/${ownerId}/${id}.${EXT[contentType] ?? 'bin'}`;
    await this.db.insert(uploads).values({ id, ownerId, purpose, storageKey, contentType, maxBytes: MAX_UPLOAD_BYTES });
    const post = await this.storage.presignUpload(storageKey, contentType, MAX_UPLOAD_BYTES, UPLOAD_URL_TTL_SEC);
    return { uploadId: id, url: post.url, fields: post.fields, expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SEC * 1000).toISOString() };
  }

  /** Called after the client finished uploading: verifies the object really exists and matches what was declared. */
  async confirm(ownerId: string, uploadId: string) {
    const upload = await this.db.query.uploads.findFirst({ where: and(eq(uploads.id, uploadId), eq(uploads.ownerId, ownerId)) });
    if (!upload) throw notFound('Upload');
    if (upload.status === 'UPLOADED') return { uploadId, sizeBytes: upload.sizeBytes };
    const info = await this.storage.head(upload.storageKey);
    if (!info) throw new AppError(ErrorCode.UPLOAD_INVALID, 'The file has not finished uploading. Please try again.');
    if (info.sizeBytes > upload.maxBytes || (info.contentType && info.contentType !== upload.contentType)) {
      await this.storage.delete(upload.storageKey);
      throw new AppError(ErrorCode.UPLOAD_INVALID, 'The uploaded file was not accepted.');
    }
    await this.db
      .update(uploads)
      .set({ status: 'UPLOADED', sizeBytes: info.sizeBytes, confirmedAt: new Date() })
      .where(eq(uploads.id, uploadId));
    return { uploadId, sizeBytes: info.sizeBytes };
  }

  /** Short-lived download URL. Callers must check access first. */
  async downloadUrl(uploadId: string, ownerId?: string) {
    const upload = await this.db.query.uploads.findFirst({
      where: ownerId ? and(eq(uploads.id, uploadId), eq(uploads.ownerId, ownerId)) : eq(uploads.id, uploadId),
    });
    if (!upload || upload.status !== 'UPLOADED') throw notFound('File');
    return {
      url: await this.storage.presignDownload(upload.storageKey, DOWNLOAD_URL_TTL_SEC),
      contentType: upload.contentType,
      expiresInSec: DOWNLOAD_URL_TTL_SEC,
      ownerId: upload.ownerId,
    };
  }
}
