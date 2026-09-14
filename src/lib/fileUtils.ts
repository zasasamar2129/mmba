/**
 * Compute SHA-256 hex digest for a base64 data URL or ArrayBuffer.
 * Used for document/file integrity checks (Patch 04 - Security).
 */
export async function computeSHA256(input: string | ArrayBuffer): Promise<string> {
  try {
    // Convert data URL to ArrayBuffer if a string is provided
    let buffer: ArrayBuffer;
    if (typeof input === 'string') {
      const base64 = input.substring(input.indexOf(',') + 1);
      const binary = atob(base64);
      buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }
    } else {
      buffer = input;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('SHA-256 computation failed:', err);
    return '';
  }
}

/**
 * Build a stable idempotency key for a file upload to prevent duplicates.
 */
export function buildFileIdempotencyKey(file: File, customerId?: string): string {
  return `${customerId || 'general'}::${file.name}::${file.size}::${file.lastModified || 0}`;
}