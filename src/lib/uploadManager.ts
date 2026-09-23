import { Attachment } from '../types';
import { prepareMobileUpload } from './heicConverter';
import { computeSHA256 } from './fileUtils';
import { storage } from '../services/storage';

export type UploadPhase =
  | 'SELECTED'
  | 'VALIDATING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED';

export interface UploadProgressItem {
  id: string;
  file: File;
  phase: UploadPhase;
  progress: number;
  fileName: string;
  fileSize: number;
  error?: string;
  attachment?: Attachment;
  abortController?: AbortController;
}

export type UploadListener = (items: UploadProgressItem[]) => void;

class UnifiedUploadManager {
  private queue: Map<string, UploadProgressItem> = new Map();
  private listeners: Set<UploadListener> = new Set();

  public subscribe(listener: UploadListener): () => void {
    this.listeners.add(listener);
    listener(this.getItems());
    return () => this.listeners.delete(listener);
  }

  public getItems(): UploadProgressItem[] {
    return Array.from(this.queue.values());
  }

  private notify() {
    const items = this.getItems();
    this.listeners.forEach((l) => l(items));
  }

  private patch(id: string, update: Partial<UploadProgressItem>) {
    const current = this.queue.get(id);
    if (!current) return;
    this.queue.set(id, { ...current, ...update });
    this.notify();
  }

  public async upload(
    file: File,
    options: {
      customerId?: string;
      customerName?: string;
      category?: string;
      maxSizeMB?: number;
      onSuccess?: (att: Attachment) => void;
      onError?: (err: string) => void;
    } = {}
  ): Promise<Attachment | null> {
    const id = `upl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const maxSizeMB = options.maxSizeMB || 10;
    const abortController = new AbortController();

    this.queue.set(id, {
      id,
      file,
      phase: 'SELECTED',
      progress: 0,
      fileName: file.name,
      fileSize: file.size,
      abortController,
    });
    this.notify();

    try {
      // 1. VALIDATING
      this.patch(id, { phase: 'VALIDATING', progress: 10 });
      if (file.size === 0) {
        throw new Error('فایل خالی است.');
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`حجم فایل بیش از سقف مجاز ${maxSizeMB}MB است.`);
      }

      // 2. PROCESSING (HEIC / scale)
      this.patch(id, { phase: 'PROCESSING', progress: 30 });
      const prepared = await prepareMobileUpload(file, {
        maxDimension: 2560,
        quality: 0.88,
      });

      const sha256 = await computeSHA256(prepared.dataUrl);

      // Duplicate check in local memory
      const existing = storage.getAttachments().find((a) => a.sha256 === sha256);
      if (existing) {
        this.patch(id, { phase: 'READY', progress: 100, attachment: existing });
        options.onSuccess?.(existing);
        return existing;
      }

      // 3. UPLOADING
      this.patch(id, { phase: 'UPLOADING', progress: 60 });
      const finalMime = prepared.mimeType || (prepared.isImage ? 'image/jpeg' : 'application/octet-stream');

      const newAtt: Attachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        fileName: prepared.fileName,
        displayName: prepared.fileName,
        originalName: file.name,
        fileType: finalMime,
        mimeType: finalMime,
        fileSize: prepared.fileSize,
        dataUrl: prepared.dataUrl,
        sha256,
        customerId: options.customerId,
        customerName: options.customerName,
        category: options.category || (prepared.isImage ? 'تصویر و مدرک شناسایی' : 'سند و قرارداد'),
        uploadedByUserId: storage.getCurrentUser().id,
        uploadedByUserName: storage.getCurrentUser().name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uploadStatus: 'PROCESSING',
      };

      // 4. UPLOADED -> wait for server response
      this.patch(id, { phase: 'UPLOADED', progress: 90 });
      const saved = storage.saveAttachment(newAtt);

      // 5. READY (Server-confirmed via saveAttachment)
      saved.uploadStatus = 'PROCESSED';
      this.patch(id, { phase: 'READY', progress: 100, attachment: saved });
      options.onSuccess?.(saved);
      return saved;
    } catch (err: any) {
      const errorMsg = err?.message || 'خطا در بارگذاری فایل';
      this.patch(id, { phase: 'FAILED', error: errorMsg });
      options.onError?.(errorMsg);
      return null;
    }
  }

  public cancel(id: string) {
    const item = this.queue.get(id);
    if (item && item.phase !== 'READY' && item.phase !== 'FAILED') {
      item.abortController?.abort();
      this.patch(id, { phase: 'CANCELLED' });
    }
  }

  public clearCompleted() {
    for (const [id, item] of this.queue.entries()) {
      if (item.phase === 'READY' || item.phase === 'CANCELLED' || item.phase === 'FAILED') {
        this.queue.delete(id);
      }
    }
    this.notify();
  }
}

export const uploadManager = new UnifiedUploadManager();
