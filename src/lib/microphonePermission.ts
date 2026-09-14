/**
 * Microphone Permission & Device Access Manager
 * Implements standard W3C getUserMedia & Permissions API workflows across
 * Chrome, Safari, iOS WebKit, Firefox, Edge, Android browsers, and PWA standalone mode.
 */

export type MicPermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable' | 'unsupported';

export type MicErrorType =
  | 'NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'NOT_READABLE'
  | 'SECURITY_ERROR'
  | 'INSECURE_CONTEXT'
  | 'ABORTED'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

export interface MicErrorInfo {
  type: MicErrorType;
  message: string;
  instructions?: string[];
  isDenied: boolean;
  canRetry: boolean;
}

export interface MicRequestResult {
  success: boolean;
  stream?: MediaStream;
  error?: MicErrorInfo;
}

/**
 * Checks if the current window is running in a Secure Context (HTTPS or localhost).
 * Microphones are strictly blocked by modern browser security models in insecure contexts.
 */
export function isAudioSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext !== undefined) {
    return window.isSecureContext;
  }
  const host = window.location.hostname;
  return (
    window.location.protocol === 'https:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost')
  );
}

/**
 * Verifies browser support for Media Devices & getUserMedia
 */
export function isMicrophoneSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean(
    (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') ||
    (navigator as any).getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia ||
    (navigator as any).msGetUserMedia
  );
}

/**
 * Checks the current permission state if supported by the browser's Permissions API.
 * Note: Many mobile browsers (iOS Safari, older Android WebViews) do not support querying microphone permission
 * and will throw a TypeError. In such cases, this gracefully returns 'prompt'.
 */
export async function getMicrophonePermissionStatus(): Promise<MicPermissionState> {
  if (!isMicrophoneSupported()) {
    return 'unsupported';
  }

  if (!isAudioSecureContext()) {
    return 'denied';
  }

  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const status = await navigator.permissions.query({ name: 'microphone' as any });
      if (status && status.state) {
        return status.state as MicPermissionState;
      }
    }
  } catch {
    // Safari and some mobile browsers throw TypeError for microphone query
  }

  return 'prompt';
}

/**
 * Resolves standard or vendor-prefixed getUserMedia
 */
export async function executeGetUserMedia(constraints: MediaStreamConstraints = { audio: true }): Promise<MediaStream> {
  if (navigator?.mediaDevices?.getUserMedia) {
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyGetUserMedia =
    (navigator as any).getUserMedia ||
    (navigator as any).webkitGetUserMedia ||
    (navigator as any).mozGetUserMedia ||
    (navigator as any).msGetUserMedia;

  if (legacyGetUserMedia) {
    return new Promise<MediaStream>((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject);
    });
  }

  throw new Error('UNSUPPORTED_MEDIA_DEVICES');
}

/**
 * Maps raw DOMException errors into structured, user-friendly Persian error information
 * with clear browser-specific guidance.
 */
export function parseMicrophoneError(err: any): MicErrorInfo {
  if (!isAudioSecureContext()) {
    return {
      type: 'INSECURE_CONTEXT',
      message: 'دسترسی به میکروفون نیازمند اتصال امن (HTTPS) است.',
      instructions: [
        'مرورگرها اجازه دسترسی به میکروفون را فقط در پروتکل امن HTTPS یا localhost می‌دهند.',
        'لطفاً آدرس سایت را با https:// باز کنید.',
      ],
      isDenied: true,
      canRetry: false,
    };
  }

  if (err?.message === 'UNSUPPORTED_MEDIA_DEVICES' || !isMicrophoneSupported()) {
    return {
      type: 'UNSUPPORTED',
      message: 'مرورگر شما از قابلیت ضبط صدا یا میکروفون پشتیبانی نمی‌کند.',
      instructions: [
        'لطفاً از نسخه‌های به‌روز گوگل کروم (Google Chrome)، سافاری (Safari) یا فایرفاکس (Firefox) استفاده فرمایید.',
      ],
      isDenied: false,
      canRetry: false,
    };
  }

  const name = err?.name || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      type: 'NOT_ALLOWED',
      message: 'مجوز دسترسی به میکروفون توسط شما یا مرورگر مسدود (Block) شده است.',
      instructions: [
        'در کروم/اج: روی آیکون قفل یا تنظیمات (Tune) در کنار آدرس سایت کلیک کرده و دسترسی Microphone را روی Allow (مجاز) قرار دهید.',
        'در آیفون (iOS Safari): وارد Settings > Safari > Microphone شده و گزینه Allow یا Ask را انتخاب کنید.',
        'در اندروید: در تنظیمات مرورگر کروم وارد Site Settings > Microphone شده و اجازه دسترسی را صادر فرمایید.',
        'سپس روی دکمه «تلاش مجدد و فعال‌سازی میکروفون» کلیک کنید.',
      ],
      isDenied: true,
      canRetry: true,
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      type: 'NOT_FOUND',
      message: 'هیچ میکروفون یا سخت‌افزار ورودی صدا در دستگاه شما شناسایی نشد.',
      instructions: [
        'از اتصال صحیح میکروفون یا هدست به دستگاه اطمینان حاصل کنید.',
        'در تنظیمات سیستم‌عامل، ورودی پیش‌فرض صدا را بررسی نمایید.',
      ],
      isDenied: false,
      canRetry: true,
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      type: 'NOT_READABLE',
      message: 'میکروفون توسط برنامه دیگری (مانند تماس، تلگرام، زوم یا تب دیگر) در حال استفاده است.',
      instructions: [
        'برنامه‌ها یا تب‌های دیگر که از میکروفون استفاده می‌کنند را ببندید و مجدداً امتحان نمایید.',
      ],
      isDenied: false,
      canRetry: true,
    };
  }

  if (name === 'SecurityError') {
    return {
      type: 'SECURITY_ERROR',
      message: 'دسترسی امنیتی به میکروفون به دلیل محدودیت فریم یا محیط مرورگر امکان‌پذیر نیست.',
      instructions: [
        'در صورتی که صفحه درون فریم قرار دارد، برنامه را در تب مستقل باز کنید.',
      ],
      isDenied: true,
      canRetry: true,
    };
  }

  if (name === 'AbortError') {
    return {
      type: 'ABORTED',
      message: 'درخواست دسترسی به میکروفون متوقف شد.',
      instructions: ['لطفاً دوباره روی شروع ضبط کلیک کنید.'],
      isDenied: false,
      canRetry: true,
    };
  }

  return {
    type: 'UNKNOWN',
    message: err?.message || 'خطای ناشناخته در برقراری ارتباط با میکروفون دستگاه.',
    instructions: ['لطفاً صفحه را رفرش کرده یا دسترسی میکروفون را در مرورگر بررسی فرمایید.'],
    isDenied: false,
    canRetry: true,
  };
}

/**
 * Explicitly requests microphone access from the browser as a DIRECT result of user interaction.
 * Uses { audio: true } directly to ensure the native browser permission dialog appears immediately.
 */
export async function requestMicrophoneAccess(keepStream = false): Promise<MicRequestResult> {
  if (!isAudioSecureContext()) {
    const errorInfo = parseMicrophoneError(new Error('INSECURE_CONTEXT'));
    return { success: false, error: errorInfo };
  }

  if (!isMicrophoneSupported()) {
    const errorInfo = parseMicrophoneError(new Error('UNSUPPORTED_MEDIA_DEVICES'));
    return { success: false, error: errorInfo };
  }

  try {
    // Primary request with simple standard audio constraints to guarantee native prompt
    const stream = await executeGetUserMedia({ audio: true });

    if (!stream || stream.getAudioTracks().length === 0) {
      throw new Error('NO_AUDIO_TRACKS');
    }

    if (!keepStream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      return { success: true };
    }

    return {
      success: true,
      stream,
    };
  } catch (err: any) {
    const errorInfo = parseMicrophoneError(err);
    return {
      success: false,
      error: errorInfo,
    };
  }
}
