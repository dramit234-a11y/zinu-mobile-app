import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';

export interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

export interface ObjectInfo {
  sizeBytes: number;
  contentType: string | undefined;
}

/**
 * Private object storage. Files never pass through the API: clients upload straight to storage with a
 * short-lived presigned POST (size and content type enforced by the storage server) and read through
 * short-lived presigned GET URLs. Works with AWS S3 and any S3-compatible server.
 */
export abstract class StorageService {
  abstract presignUpload(key: string, contentType: string, maxBytes: number, expiresInSec: number): Promise<PresignedPost>;
  abstract presignDownload(key: string, expiresInSec: number): Promise<string>;
  abstract head(key: string): Promise<ObjectInfo | null>;
  abstract delete(key: string): Promise<void>;
}

@Injectable()
export class S3StorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  /** Server-side operations (HEAD, DELETE, bucket checks). */
  private readonly internal: S3Client;
  /** Signs URLs with the host clients can reach. */
  private readonly publicClient: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    const base: S3ClientConfig = {
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      ...(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } }
        : {}),
    };
    this.internal = new S3Client({ ...base, ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}) });
    const publicEndpoint = env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT;
    this.publicClient = new S3Client({ ...base, ...(publicEndpoint ? { endpoint: publicEndpoint } : {}) });
  }

  async onModuleInit() {
    if (!this.env.S3_AUTO_CREATE_BUCKET) return;
    try {
      await this.internal.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }));
    } catch {
      await this.internal.send(new CreateBucketCommand({ Bucket: this.env.S3_BUCKET }));
      this.logger.log(`Created bucket ${this.env.S3_BUCKET}`);
    }
  }

  presignUpload(key: string, contentType: string, maxBytes: number, expiresInSec: number) {
    return createPresignedPost(this.publicClient, {
      Bucket: this.env.S3_BUCKET,
      Key: key,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Expires: expiresInSec,
    });
  }

  presignDownload(key: string, expiresInSec: number) {
    return getSignedUrl(this.publicClient, new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }), { expiresIn: expiresInSec });
  }

  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const res = await this.internal.send(new HeadObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
      return { sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || status === 403) return null;
      throw e;
    }
  }

  async delete(key: string) {
    await this.internal.send(new DeleteObjectCommand({ Bucket: this.env.S3_BUCKET, Key: key }));
  }
}
