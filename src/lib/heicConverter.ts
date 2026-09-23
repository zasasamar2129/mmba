/**
 * HEIC / HEIF format detection, mobile photo optimization, and conversion utility.
 * Seamlessly handles Apple iPhone HEIC/HEIF images and Android camera uploads.
 */

// Dynamic importer to ensure heic2any is only loaded when needed and avoids SSR issues
let heic2anyModule: any = null;

async function getHeic2Any(): Promise<any> {
  if (!heic2anyModule) {
    const mod = await import('heic2any');
    heic2anyModule = mod.default || mod;
  }
  return heic2anyModule;
}

/**
 * Checks if a file or filename or mime type indicates a HEIC / HEIF image.
 */
export function isHeicFile(fileOrNameOrMime: File | Blob | string): boolean {
  if (!fileOrNameOrMime) return false;

  let name = '';
  let type = '';

  if (typeof fileOrNameOrMime === 'string') {
    name = fileOrNameOrMime.toLowerCase();
    type = fileOrNameOrMime.toLowerCase();
  } else {
    name = (fileOrNameOrMime as File).name?.toLowerCase() || '';
    type = fileOrNameOrMime.type?.toLowerCase() || '';
  }

  // Check extension
  if (/\.(heic|heif|hif)$/i.test(name)) {
    return true;
  }

  // Check MIME
  if (type.includes('heic') || type.includes('heif')) {
    return true;
  }

  return false;
}

/**
 * Synchronous magic byte sniffer for HEIC / HEIF ISO Base Media files.
 * Checks for 'ftyp' at offset 4 and HEIC brand strings at offset 8.
 */
export function isHeicMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // bytes 4-7 must be 'ftyp' (0x66, 0x74, 0x79, 0x70)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heis', 'heim', 'hevs'].includes(brand);
  }
  return false;
}

/**
 * Converts a HEIC/HEIF File or Blob into a standard JPEG Blob.
 */
export async function convertHeicToBlob(fileOrBlob: File | Blob, quality = 0.88): Promise<Blob> {
  const heic2any = await getHeic2Any();
  const result = await heic2any({
    blob: fileOrBlob,
    toType: 'image/jpeg',
    quality,
  });

  if (Array.isArray(result)) {
    return result[0];
  }
  return result;
}

/**
 * Converts a HEIC base64 data URL into a standard JPEG base64 data URL.
 */
export async function convertHeicDataUrlToJpeg(dataUrl: string, quality = 0.88): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  
  // Quick check if it's already jpeg/png/webp
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/webp')) {
    return dataUrl;
  }

  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;
    const base64 = dataUrl.substring(commaIdx + 1);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'image/heic' });
    const convertedBlob = await convertHeicToBlob(blob, quality);

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(convertedBlob);
    });
  } catch (err) {
    console.warn('HEIC dataUrl conversion failed, returning original:', err);
    return dataUrl;
  }
}

export interface PreparedUploadResult {
  file: File;
  dataUrl: string;
  fileName: string;
  originalName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  isImage: boolean;
  isConvertedHeic: boolean;
}

/**
 * Robust universal file preprocessor for mobile (iPhone / Android) and desktop uploads.
 * 1. Accurately detects HEIC / HEIF files and converts them to standard high-res JPEG.
 * 2. Downscales oversized mobile camera photos (e.g. 15MB 48MP photos) to sharp, legible ~300KB-600KB JPEGs.
 * 3. Normalizes missing or generic file extensions and MIME types.
 * 4. Produces clean, safe data URLs ready for preview and IndexedDB storage.
 */
export async function prepareMobileUpload(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    onConversionNotice?: (msg: string) => void;
  } = {}
): Promise<PreparedUploadResult> {
  const maxDim = options.maxDimension || 2048;
  const quality = options.quality !== undefined ? options.quality : 0.85;
  const originalName = file.name || 'unnamed_file';
  let processedFile = file;
  let isConvertedHeic = false;

  // Sniff magic bytes of the first 16 bytes
  let isHeic = isHeicFile(file);
  try {
    const slice = file.slice(0, 16);
    const buf = await slice.arrayBuffer();
    if (isHeicMagicBytes(new Uint8Array(buf))) {
      isHeic = true;
    }
  } catch (_) {}

  // 1. Convert HEIC if detected
  if (isHeic) {
    if (options.onConversionNotice) {
      options.onConversionNotice('در حال پردازش و تبدیل فرمت HEIC آیفون به JPG...');
    }
    try {
      const jpegBlob = await convertHeicToBlob(file, quality);
      const cleanBase = originalName.replace(/\.[^/.]+$/, '') || 'iphone_photo';
      const newName = `${cleanBase}.jpg`;
      processedFile = new File([jpegBlob], newName, { type: 'image/jpeg', lastModified: Date.now() });
      isConvertedHeic = true;
    } catch (err) {
      console.warn('Could not convert HEIC via heic2any, falling back to original file:', err);
    }
  }

  // 2. Determine MIME type and isImage
  let mimeType = processedFile.type || '';
  const extMatch = processedFile.name.match(/\.([a-zA-Z0-9]+)$/);
  let ext = (extMatch ? extMatch[1] : '').toLowerCase();

  // Sniff magic bytes if MIME is generic or missing
  if (!mimeType || mimeType === 'application/octet-stream') {
    try {
      const headerSlice = processedFile.slice(0, 24);
      const headerBuf = await headerSlice.arrayBuffer();
      const bytes = new Uint8Array(headerBuf);

      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        mimeType = 'image/jpeg';
        if (!ext) ext = 'jpg';
      } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        mimeType = 'image/png';
        if (!ext) ext = 'png';
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        mimeType = 'image/gif';
        if (!ext) ext = 'gif';
      } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        mimeType = 'image/webp';
        if (!ext) ext = 'webp';
      } else if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        mimeType = 'application/pdf';
        if (!ext) ext = 'pdf';
      }
    } catch (_) {}
  }

  // If filename still lacks extension, add appropriate one
  let finalFileName = processedFile.name;
  if (!ext) {
    if (mimeType === 'image/jpeg') {
      finalFileName = `${processedFile.name}.jpg`;
      ext = 'jpg';
    } else if (mimeType === 'image/png') {
      finalFileName = `${processedFile.name}.png`;
      ext = 'png';
    } else if (mimeType === 'image/webp') {
      finalFileName = `${processedFile.name}.webp`;
      ext = 'webp';
    } else if (mimeType === 'application/pdf') {
      finalFileName = `${processedFile.name}.pdf`;
      ext = 'pdf';
    }
  }

  const isImage = mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'heic', 'heif'].includes(ext);

  // 3. For large images (e.g. Android/iPhone camera photos > 1MB or > maxDim), downscale cleanly via Canvas
  if (isImage && !['image/svg+xml', 'image/gif'].includes(mimeType) && (processedFile.size > 1.2 * 1024 * 1024 || isConvertedHeic)) {
    try {
      const downscaled = await downscaleImageCanvas(processedFile, maxDim, quality, finalFileName);
      return {
        file: downscaled.file,
        dataUrl: downscaled.dataUrl,
        fileName: downscaled.fileName,
        originalName,
        fileType: downscaled.file.type,
        mimeType: downscaled.file.type || 'image/jpeg',
        fileSize: downscaled.file.size,
        isImage: true,
        isConvertedHeic,
      };
    } catch (downscaleErr) {
      console.warn('Canvas downscaling skipped or failed, using processed file:', downscaleErr);
    }
  }

  // 4. Default FileReader read
  const dataUrl = await readFileAsDataUrl(processedFile);
  return {
    file: processedFile,
    dataUrl,
    fileName: finalFileName,
    originalName,
    fileType: mimeType || 'application/octet-stream',
    mimeType: mimeType || 'application/octet-stream',
    fileSize: processedFile.size,
    isImage,
    isConvertedHeic,
  };
}

/**
 * Downscales an image File using HTML Canvas while preserving aspect ratio.
 */
function downscaleImageCanvas(
  file: File | Blob,
  maxDim: number,
  quality: number,
  fileName: string
): Promise<{ file: File; dataUrl: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              file: file instanceof File ? file : new File([file], fileName, { type: 'image/jpeg' }),
              dataUrl: rawDataUrl,
              fileName,
            });
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(outputType, quality);

          // Convert to Blob/File
          const base64Str = compressedDataUrl.split(',')[1] || '';
          const binary = atob(base64Str);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          const cleanBase = fileName.replace(/\.[^/.]+$/, '') || 'photo';
          const outName = `${cleanBase}.jpg`;
          const compressedBlob = new Blob([bytes], { type: outputType });
          const compressedFile = new File([compressedBlob], outName, { type: outputType, lastModified: Date.now() });

          resolve({
            file: compressedFile,
            dataUrl: compressedDataUrl,
            fileName: outName,
          });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر در مرورگر'));
      img.src = rawDataUrl;
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.readAsDataURL(file);
  });
}
