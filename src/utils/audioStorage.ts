import {
  storage,
  storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from '../lib/firebase';

/**
 * Format duration seconds into mm:ss
 */
export function formatSecondsToTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Human-readable byte formatting
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Read the duration of an audio file in the browser without uploading first
 */
export function detectAudioDuration(file: File): Promise<{ durationFormatted: string; durationSeconds: number }> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      audio.preload = 'metadata';

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        audio.removeEventListener('loadedmetadata', handleLoaded);
        audio.removeEventListener('error', handleError);
      };

      const handleLoaded = () => {
        const sec = audio.duration;
        cleanup();
        if (!isNaN(sec) && sec > 0) {
          resolve({
            durationFormatted: formatSecondsToTime(sec),
            durationSeconds: Math.round(sec),
          });
        } else {
          resolve({ durationFormatted: '03:30', durationSeconds: 210 });
        }
      };

      const handleError = () => {
        cleanup();
        resolve({ durationFormatted: '03:30', durationSeconds: 210 });
      };

      audio.addEventListener('loadedmetadata', handleLoaded);
      audio.addEventListener('error', handleError);
      audio.src = objectUrl;

      // Timeout fallback in case metadata doesn't trigger
      setTimeout(() => {
        cleanup();
        resolve({ durationFormatted: '03:30', durationSeconds: 210 });
      }, 3500);
    } catch {
      resolve({ durationFormatted: '03:30', durationSeconds: 210 });
    }
  });
}

/**
 * Upload an audio file (mp3, wav, m4a, ogg) to Firebase Storage
 */
export async function uploadAudioFileToStorage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; storagePath: string; fileSize: number }> {
  const sanitizedName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();

  const timestamp = Date.now();
  const storagePath = `music_tracks/${timestamp}_${sanitizedName}`;
  const fileRef = storageRef(storage, storagePath);

  const contentType = file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg');
  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType,
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(progress);
        }
      },
      (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadUrl,
            storagePath,
            fileSize: file.size,
          });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Upload an optional cover art image to Firebase Storage
 */
export async function uploadCoverImageToStorage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; storagePath: string }> {
  const sanitizedName = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();

  const timestamp = Date.now();
  const storagePath = `music_covers/${timestamp}_${sanitizedName}`;
  const fileRef = storageRef(storage, storagePath);

  const uploadTask = uploadBytesResumable(fileRef, file, {
    contentType: file.type || 'image/jpeg',
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(progress);
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ downloadUrl, storagePath });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteStorageFile(storagePath?: string): Promise<boolean> {
  if (!storagePath) return false;
  try {
    const fileRef = storageRef(storage, storagePath);
    await deleteObject(fileRef);
    return true;
  } catch (err) {
    console.warn('Could not delete file from Firebase Storage (may already be removed):', err);
    return false;
  }
}
