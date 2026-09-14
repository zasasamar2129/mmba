/**
 * Utility to optimize, resize, and compress ID card images and scanned documents.
 * Automatically downscales multi-megapixel camera photos (e.g. 10MB from iPhone/Android)
 * to crystal-clear, legible documents under ~200KB.
 */

export interface CompressedImageResult {
  dataUrl: string;
  size: number;
  type: string;
  name: string;
  width?: number;
  height?: number;
}

export async function compressIdCardImage(
  file: File | Blob,
  fileNameOrOptions?: string | { maxDimension?: number; maxWidth?: number; maxHeight?: number; quality?: number; fileName?: string },
  maybeOptions: { maxDimension?: number; quality?: number } = {}
): Promise<CompressedImageResult> {
  const opts = typeof fileNameOrOptions === 'object' ? fileNameOrOptions : maybeOptions;
  const fileName = typeof fileNameOrOptions === 'string' ? fileNameOrOptions : fileNameOrOptions?.fileName;
  const maxDim = opts.maxDimension || (opts as any).maxWidth || (opts as any).maxHeight || 1600;
  const quality = opts.quality !== undefined ? opts.quality : 0.82;
  const name = fileName || (file instanceof File ? file.name : 'id_card.jpg');
  const mimeType = file.type || 'image/jpeg';

  // If the file is a PDF, don't attempt canvas processing
  if (mimeType === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({
          dataUrl,
          size: file.size,
          type: 'application/pdf',
          name,
        });
      };
      reader.onerror = () => reject(new Error('خطا در خواندن فایل PDF'));
      reader.readAsDataURL(file);
    });
  }

  // Process image files via Canvas
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Maintain aspect ratio while bounding within maxDim
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
            // Fallback to original dataUrl if canvas context is unavailable
            const rawUrl = event.target?.result as string;
            resolve({
              dataUrl: rawUrl,
              size: file.size,
              type: mimeType,
              name,
              width: img.width,
              height: img.height,
            });
            return;
          }

          // Smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Optional white background in case of transparent PNG converted to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);

          // Draw the full image without cropping
          ctx.drawImage(img, 0, 0, width, height);

          const outputType = 'image/jpeg';
          const compressedDataUrl = canvas.toDataURL(outputType, quality);

          // Calculate actual byte size from base64 string
          const base64Str = compressedDataUrl.split(',')[1] || '';
          const calculatedSize = Math.round((base64Str.length * 3) / 4);

          // Ensure output file has proper extension
          const cleanBaseName = name.replace(/\.[^/.]+$/, '');
          const outputName = `${cleanBaseName}.jpg`;

          resolve({
            dataUrl: compressedDataUrl,
            size: calculatedSize,
            type: outputType,
            name: outputName,
            width,
            height,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر جهت بهینه‌سازی'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('خطا در خواندن فایل انتخاب شده'));
    reader.readAsDataURL(file);
  });
}
