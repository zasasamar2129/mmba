import { Attachment } from '../types';

export interface DetectedFileInfo {
  mimeType: string;
  extension: string;
  isImage: boolean;
  isPdf: boolean;
  isText: boolean;
  isSpreadsheet: boolean;
  isDocument: boolean;
  isArchive: boolean;
  displayType: string;
  colorClass: string;
}

/**
 * Accurately detects file type and MIME info using dataUrl header, magic bytes,
 * explicit MIME metadata, and filename extension fallback.
 */
export function detectFileInfo(
  item: Partial<Attachment> | { fileName?: string; filename?: string; fileType?: string; mimeType?: string; dataUrl?: string }
): DetectedFileInfo {
  const fileName = (item.fileName || (item as any).filename || '').trim();
  const rawMime = (item.fileType || item.mimeType || '').trim().toLowerCase();
  const dataUrl = (item.dataUrl || '').trim();

  // Detect extension first - used for fallback and display
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  let extension = (extMatch ? extMatch[1] : '').toLowerCase();

  // Sniff magic bytes FIRST from base64 if available - this is the ground truth
  let sniffedMime: string | null = null;
  if (dataUrl.startsWith('data:')) {
    const b64Data = dataUrl.substring(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 48);
    if (b64Data.startsWith('iVBORw0KGgo')) {
      sniffedMime = 'image/png';
    } else if (b64Data.startsWith('/9j/')) {
      sniffedMime = 'image/jpeg';
    } else if (b64Data.startsWith('R0lGOD')) {
      sniffedMime = 'image/gif';
    } else if (b64Data.startsWith('UklGR')) {
      sniffedMime = 'image/webp';
    } else if (b64Data.startsWith('JVBERi')) {
      sniffedMime = 'application/pdf';
    } else if (b64Data.startsWith('PHN2Zy') || b64Data.startsWith('PD94bWw')) {
      sniffedMime = 'image/svg+xml';
    } else if (
      b64Data.startsWith('AAAAOGk') ||
      b64Data.startsWith('AAAAGGk') ||
      b64Data.startsWith('AAAAUGk') ||
      b64Data.startsWith('AAAA') && (b64Data.includes('ZnR5cA') || b64Data.includes('aGVp'))
    ) {
      sniffedMime = 'image/heic';
    }
  }

  // Extract MIME from dataUrl header if present and valid
  let mimeType = sniffedMime || rawMime;
  if (!sniffedMime && dataUrl.startsWith('data:')) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 5) {
      const headerPart = dataUrl.substring(5, commaIdx);
      const extracted = headerPart.split(';')[0];
      // Only accept non-generic MIME
      if (extracted && extracted !== 'application/octet-stream') {
        // Buggy mobile browsers send application/json for photos!
        if (extracted === 'application/json' && extension !== 'json') {
          // Ignore buggy json header for non-json extensions
        } else {
          mimeType = extracted.toLowerCase();
        }
      }
    }
  }

  // If mimeType is still unknown or generic or buggy json
  if (!mimeType || mimeType === 'application/octet-stream' || (mimeType === 'application/json' && extension !== 'json')) {
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg';
        break;
      case 'png':
        mimeType = 'image/png';
        break;
      case 'webp':
        mimeType = 'image/webp';
        break;
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'svg':
        mimeType = 'image/svg+xml';
        break;
      case 'bmp':
        mimeType = 'image/bmp';
        break;
      case 'heic':
      case 'heif':
        mimeType = 'image/heic';
        break;
      case 'pdf':
        mimeType = 'application/pdf';
        break;
      case 'txt':
      case 'log':
        mimeType = 'text/plain';
        break;
      case 'csv':
        mimeType = 'text/csv';
        break;
      case 'json':
        mimeType = 'application/json';
        break;
      case 'doc':
        mimeType = 'application/msword';
        break;
      case 'docx':
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'xls':
        mimeType = 'application/vnd.ms-excel';
        break;
      case 'xlsx':
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'zip':
        mimeType = 'application/zip';
        break;
      case 'rar':
        mimeType = 'application/x-rar-compressed';
        break;
      case 'mp4':
      case 'mov':
      case 'avi':
      case 'mkv':
        mimeType = 'video/' + extension;
        break;
      case 'mp3':
      case 'wav':
      case 'm4a':
      case 'aac':
        mimeType = 'audio/' + extension;
        break;
      default:
        // If sniffed as image, default to image/jpeg
        mimeType = sniffedMime || 'application/octet-stream';
    }
  }

  // If extension is empty but MIME is known image, backfill extension
  if (!extension && mimeType.startsWith('image/')) {
    if (mimeType === 'image/jpeg') extension = 'jpg';
    else if (mimeType === 'image/png') extension = 'png';
    else if (mimeType === 'image/webp') extension = 'webp';
    else if (mimeType === 'image/heic') extension = 'heic';
  }

  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'heic', 'heif'].includes(extension) || !!sniffedMime?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf' || extension === 'pdf' || sniffedMime === 'application/pdf';
  const isText = !isImage && !isPdf && (mimeType.startsWith('text/') || (mimeType === 'application/json' && extension === 'json') || ['txt', 'csv', 'log', 'md', 'xml'].includes(extension));
  const isSpreadsheet = !isImage && (['xls', 'xlsx', 'csv', 'ods'].includes(extension) || mimeType.includes('spreadsheet') || mimeType.includes('excel'));
  const isDocument = !isImage && (['doc', 'docx', 'rtf', 'odt', 'pages'].includes(extension) || mimeType.includes('wordprocessing'));
  const isArchive = !isImage && (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) || mimeType.includes('zip') || mimeType.includes('compressed'));

  let displayType = extension.toUpperCase() || 'FILE';
  if (isImage) {
    if (extension === 'jpg' || extension === 'jpeg') displayType = 'JPEG';
    else if (extension === 'png') displayType = 'PNG';
    else if (extension === 'webp') displayType = 'WEBP';
    else if (extension === 'gif') displayType = 'GIF';
    else if (extension === 'svg') displayType = 'SVG';
    else if (extension === 'heic' || extension === 'heif') displayType = 'HEIC';
    else displayType = 'IMAGE';
  } else if (isPdf) {
    displayType = 'PDF';
  } else if (isSpreadsheet) {
    displayType = 'EXCEL';
  } else if (isDocument) {
    displayType = 'DOC';
  } else if (isArchive) {
    displayType = 'ZIP';
  } else if (['mp4', 'mov', 'avi', 'mkv'].includes(extension)) {
    displayType = 'VIDEO';
  } else if (['mp3', 'wav', 'm4a', 'aac'].includes(extension)) {
    displayType = 'AUDIO';
  }

  let colorClass = 'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  if (isImage) {
    colorClass = 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800';
  } else if (isPdf) {
    colorClass = 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
  } else if (isSpreadsheet) {
    colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
  } else if (isDocument) {
    colorClass = 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
  } else if (isArchive) {
    colorClass = 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
  }

  return {
    mimeType,
    extension,
    isImage,
    isPdf,
    isText,
    isSpreadsheet,
    isDocument,
    isArchive,
    displayType,
    colorClass,
  };
}

/**
 * Formats file size in bytes to human readable format.
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return '—';
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Returns an authenticated preview or download URL for an attachment,
 * with graceful fallback to its direct dataUrl.
 */
export function getAttachmentSrc(
  att: Partial<Attachment> & { id?: string; dataUrl?: string },
  download = false
): string {
  // If we have an attachment ID, we can also use the authenticated backend endpoint
  const token = typeof window !== 'undefined' ? localStorage.getItem('mmba_auth_token') || '' : '';
  
  if (att.id && !att.id.startsWith('temp-')) {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (download) params.set('download', '1');
    const qs = params.toString();
    const endpoint = `/api/v1/attachments/${att.id}/content${qs ? `?${qs}` : ''}`;
    
    // If we have direct dataUrl and NOT downloading, direct dataUrl has zero network latency
    if (att.dataUrl && !download) {
      return att.dataUrl;
    }
    return endpoint;
  }

  return att.dataUrl || '';
}

/**
 * Triggers safe client download of an attachment with exact original filename.
 */
export function downloadAttachment(att: Partial<Attachment> & { fileName?: string; dataUrl?: string; id?: string }) {
  let fileName = att.fileName || (att as any).filename || 'download';
  const info = detectFileInfo(att);

  // If the file is an image, make sure it downloads as an image, not as a .json file!
  if (info.isImage) {
    if (fileName.toLowerCase().endsWith('.json')) {
      fileName = fileName.replace(/\.json$/i, '.jpg');
    } else if (!/\.(jpg|jpeg|png|webp|gif|svg|heic|heif)$/i.test(fileName)) {
      const ext = info.extension && info.extension !== 'json' ? info.extension : 'jpg';
      fileName = `${fileName}.${ext}`;
    }
  }

  // Ensure dataUrl has the correct image MIME type instead of application/json
  let finalDataUrl = att.dataUrl;
  if (info.isImage && finalDataUrl && finalDataUrl.startsWith('data:')) {
    if (finalDataUrl.startsWith('data:application/json') || finalDataUrl.startsWith('data:application/octet-stream')) {
      const commaIdx = finalDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        finalDataUrl = `data:${info.mimeType || 'image/jpeg'}${finalDataUrl.substring(commaIdx)}`;
      }
    }
  }

  if (finalDataUrl) {
    const link = document.createElement('a');
    link.href = finalDataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (att.id) {
    const url = getAttachmentSrc(att, true);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Downscales an image data URL in-browser using Offscreen Canvas
 * to generate a fast, lightweight thumbnail (under 30KB) for lists and grids.
 * Converts HEIC/HEIF to JPEG first since browsers can't render them natively.
 */
export async function createThumbnail(dataUrl: string, maxDim = 240): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  // If already an SVG or tiny dataUrl, return as is
  if (dataUrl.includes('image/svg+xml') || dataUrl.length < 25000) {
    return dataUrl;
  }

  // Fix wrong MIME in data URL header (e.g. application/json for PNG from mobile browsers)
  let normalizedDataUrl = dataUrl;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx > 5) {
    const headerPart = dataUrl.substring(5, commaIdx);
    const headerMime = headerPart.split(';')[0];
    // Sniff actual format from magic bytes
    const b64Data = dataUrl.substring(commaIdx + 1, commaIdx + 32);
    let sniffed: string | null = null;
    if (b64Data.startsWith('iVBORw0KGgo')) sniffed = 'image/png';
    else if (b64Data.startsWith('/9j/')) sniffed = 'image/jpeg';
    else if (b64Data.startsWith('R0lGOD')) sniffed = 'image/gif';
    else if (b64Data.startsWith('UklGR')) sniffed = 'image/webp';
    else if (b64Data.startsWith('AAAAOGk') || b64Data.startsWith('AAAAGGk') || b64Data.startsWith('AAAAUGk')) sniffed = 'image/heic';
    if (sniffed && headerMime !== sniffed && sniffed !== 'image/heic') {
      // Rewrite header with correct MIME so canvas can decode it
      normalizedDataUrl = `data:${sniffed}${headerPart.substring(headerMime.length)}${dataUrl.substring(commaIdx)}`;
    }
  }

  dataUrl = normalizedDataUrl;

  // HEIC/HEIF cannot be drawn to canvas directly - convert first
  if (dataUrl.includes('image/heic') || dataUrl.includes('image/heif')) {
    try {
      const jpegDataUrl = await convertHeicToJpeg(dataUrl);
      if (jpegDataUrl) {
        dataUrl = jpegDataUrl;
      }
    } catch {
      // Conversion failed - return original
      return dataUrl;
    }
  }

  // Only image types can be thumbnailed
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          if (width <= maxDim && height <= maxDim) {
            resolve(dataUrl);
            return;
          }

          let targetWidth = width;
          let targetHeight = height;

          if (width > height) {
            if (width > maxDim) {
              targetHeight = Math.round((height * maxDim) / width);
              targetWidth = maxDim;
            }
          } else {
            if (height > maxDim) {
              targetWidth = Math.round((width * maxDim) / height);
              targetHeight = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // Crisp downsampling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const thumbDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(thumbDataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Converts a HEIC/HEIF data URL to JPEG using heic2any
 * Loaded dynamically to avoid bloating the main bundle
 */
async function convertHeicToJpeg(dataUrl: string): Promise<string | null> {
  try {
    // Dynamically import heic2any only when needed
    const { default: heic2any } = await import('heic2any');
    const blob = await dataUrlToBlob(dataUrl);
    const jpegBlob = await heic2any({
      blob,
      toType: 'image/jpeg',
      quality: 0.85,
    });
    return blobToDataUrl(jpegBlob as Blob);
  } catch {
    return null;
  }
}

/**
 * Converts a data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then(res => res.blob());
}

/**
 * Converts a Blob to a data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
