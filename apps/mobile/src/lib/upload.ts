import { MAX_UPLOAD_BYTES } from '@zinu/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { ApiError, api } from './api';

/** Long edge of uploaded document photos: sharp enough to read a licence, small enough for 2G/3G uploads. */
const MAX_EDGE = 1600;

/**
 * Compresses a photo, uploads it straight to private storage with a presigned POST, then confirms it with the API.
 * The API never receives the file bytes; storage enforces the size and type limits.
 */
export async function uploadDocumentPhoto(localUri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(localUri);
  if ((width ?? MAX_EDGE + 1) > MAX_EDGE || (height ?? MAX_EDGE + 1) > MAX_EDGE) {
    ctx.resize((width ?? 0) >= (height ?? 0) ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const rendered = await ctx.renderAsync();
  const photo = await rendered.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });

  const blob = await (await fetch(photo.uri)).blob();
  if (blob.size > MAX_UPLOAD_BYTES) throw new ApiError(400, 'UPLOAD_INVALID', 'Photo is too large');

  const presigned = await api.presignUpload({ purpose: 'DRIVER_DOCUMENT', contentType: 'image/jpeg', sizeBytes: blob.size });
  const form = new FormData();
  for (const [k, v] of Object.entries(presigned.fields)) form.append(k, v);
  // React Native streams the file from disk when given { uri, name, type }; the web preview needs a Blob.
  if (Platform.OS === 'web') form.append('file', blob, 'photo.jpg');
  else form.append('file', { uri: photo.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(presigned.url, { method: 'POST', body: form });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Upload failed. Check your internet connection.');
  }
  if (res.status >= 300) throw new ApiError(res.status, 'UPLOAD_INVALID', 'Upload failed. Please try again.');
  await api.confirmUpload(presigned.uploadId);
  return presigned.uploadId;
}
