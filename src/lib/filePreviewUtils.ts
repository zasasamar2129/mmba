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

  let mimeType = rawMime;

  // Extract from dataUrl if available
  if (dataUrl.startsWith('data:')) {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 5) {
      const headerPart = dataUrl.substring(5, commaIdx);
      const extracted = headerPart.split(';')[0];
      if (extracted && extracted !== 'application/octet-stream') {
        mimeType = extracted.toLowerCase();
      }
    }
  }

  // Detect extension
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const extension = (extMatch ? extMatch[1] : '').toLowerCase();

  // Sniff magic bytes from base64 if MIME is still generic or octet-stream
  if (!mimeType || mimeType === 'application/octet-stream') {
    const b64Data = dataUrl.startsWith('data:') ? dataUrl.substring(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 32) : '';
    if (b64Data.startsWith('iVBORw0KGgo')) {
      mimeType = 'image/png';
    } else if (b64Data.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (b64Data.startsWith('R0lGOD')) {
      mimeType = 'image/gif';
    } else if (b64Data.startsWith('UklGR')) {
      mimeType = 'image/webp';
    } else if (b64Data.startsWith('JVBERi')) {
      mimeType = 'application/pdf';
    } else if (b64Data.startsWith('PHN2Zy') || b64Data.startsWith('PD94bWw')) {
      mimeType = 'image/svg+xml';
    }
  }

  // Fallback to extension if MIME is still unknown
  if (!mimeType || mimeType === 'application/octet-stream') {
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
      default:
        mimeType = 'application/octet-stream';
    }
  }

  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(extension);
  const isPdf = mimeType === 'application/pdf' || extension === 'pdf';
  const isText = mimeType.startsWith('text/') || mimeType === 'application/json' || ['txt', 'csv', 'log', 'json', 'md', 'xml'].includes(extension);
  const isSpreadsheet = ['xls', 'xlsx', 'csv', 'ods'].includes(extension) || mimeType.includes('spreadsheet') || mimeType.includes('excel');
  const isDocument = ['doc', 'docx', 'rtf', 'odt', 'pages'].includes(extension) || mimeType.includes('wordprocessing');
  const isArchive = ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension) || mimeType.includes('zip') || mimeType.includes('compressed');

  let displayType = extension.toUpperCase() || 'FILE';
  if (isImage) {
    if (extension === 'jpg' || extension === 'jpeg') displayType = 'JPEG';
    else if (extension === 'png') displayType = 'PNG';
    else if (extension === 'webp') displayType = 'WEBP';
    else if (extension === 'gif') displayType = 'GIF';
    else if (extension === 'svg') displayType = 'SVG';
    else displayType = 'IMAGE';
  } else if (isPdf) {
    displayType = 'PDF';
  } else if (isSpreadsheet) {
    displayType = 'EXCEL';
  } else if (isDocument) {
    displayType = 'DOC';
  } else if (isArchive) {
    displayType = 'ZIP';
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
  const fileName = att.fileName || (att as any).filename || 'download';
  
  if (att.dataUrl) {
    const link = document.createElement('a');
    link.href = att.dataUrl;
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
 */
export async function createThumbnail(dataUrl: string, maxDim = 240): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // If already an SVG or tiny dataUrl, return as is
  if (dataUrl.includes('image/svg+xml') || dataUrl.length < 25000) {
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
