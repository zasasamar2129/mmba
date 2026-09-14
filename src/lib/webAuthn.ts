/**
 * WebAuthn / Passkey Biometric Authentication Helper
 * MMBA Enterprise CRM
 */

import { api } from '../services/api';
import { User } from '../types';

export function isWebAuthnAvailable(): boolean {
  return typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function';
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function detectDeviceMetadata(): { name: string; type: string } {
  const ua = navigator.userAgent || '';
  if (/iPhone/i.test(ua)) {
    // iPhone X and later have Face ID, iPhone 8 and earlier have Touch ID
    const isModern = /iPhone1[1-9]|iPhone[2-9]/i.test(ua) || window.screen.height >= 812;
    return {
      name: isModern ? 'آیفون (Face ID)' : 'آیفون (Touch ID)',
      type: isModern ? 'FACE_ID' : 'TOUCH_ID',
    };
  }
  if (/iPad/i.test(ua)) {
    return { name: 'آی‌پد (Touch ID / Face ID)', type: 'TOUCH_ID' };
  }
  if (/Android/i.test(ua)) {
    return { name: 'دستگاه اندروید (اثر انگشت / بیومتریک)', type: 'ANDROID_BIOMETRIC' };
  }
  if (/Macintosh/i.test(ua)) {
    return { name: 'مک‌بوک / مک (Touch ID)', type: 'TOUCH_ID' };
  }
  if (/Windows/i.test(ua)) {
    return { name: 'ویندوز (Windows Hello)', type: 'WINDOWS_HELLO' };
  }
  return { name: 'دستگاه امنیتی سخت‌افزاری (Security Key)', type: 'SECURITY_KEY' };
}

/**
 * Register a new Passkey / Platform Authenticator for the current user
 */
export async function registerBiometricPasskey(currentUser: User): Promise<{ success: boolean; message: string; device?: any }> {
  if (!isWebAuthnAvailable()) {
    return { success: false, message: 'مرورگر یا دستگاه فعلی شما از استاندارد امنیتی Passkey پشتیبانی نمی‌کند.' };
  }

  try {
    let challengeBuffer: ArrayBuffer;
    try {
      const challengeRes = await api.getBiometricChallenge();
      challengeBuffer = new TextEncoder().encode(challengeRes.challenge);
    } catch {
      challengeBuffer = crypto.getRandomValues(new Uint8Array(32));
    }

    const userIdBuffer = new TextEncoder().encode(currentUser.id || 'usr-default');
    const deviceMeta = detectDeviceMetadata();

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: challengeBuffer,
        rp: {
          name: 'سامانه متمرکز MMBA CRM',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userIdBuffer,
          name: currentUser.username,
          displayName: currentUser.name || currentUser.username,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { success: false, message: 'عملیات فعال‌سازی لغو گردید.' };
    }

    const credentialId = bufferToBase64Url(credential.rawId);

    // Save to server
    const saveRes = await api.registerBiometricDevice({
      credentialId,
      deviceName: deviceMeta.name,
      deviceType: deviceMeta.type,
      publicKey: credentialId, // Token identifier
    });

    if (saveRes.success && saveRes.device) {
      // Save local hint so login page knows biometric is available
      localStorage.setItem('mmba_biometric_credential_id', credentialId);
      localStorage.setItem('mmba_biometric_username', currentUser.username);
      localStorage.setItem('mmba_biometric_device_name', deviceMeta.name);

      return {
        success: true,
        message: `ورود بیومتریک (${deviceMeta.name}) با موفقیت در این دستگاه فعال گردید.`,
        device: saveRes.device,
      };
    }

    return { success: false, message: 'خطا در ثبت مشخصات دستگاه در سرور مرکزی.' };
  } catch (err: any) {
    console.error('Biometric registration error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, message: 'دسترسی بیومتریک توسط کاربر لغو شد یا زمان به پایان رسید.' };
    }
    return { success: false, message: err.message || 'خطا در برقراری ارتباط با حسگر بیومتریک دستگاه' };
  }
}

/**
 * Authenticate with Passkey
 */
export async function authenticateWithBiometric(): Promise<{ success: boolean; user?: User; token?: string; message: string }> {
  if (!isWebAuthnAvailable()) {
    return { success: false, message: 'مرورگر یا دستگاه فعلی از ورود بیومتریک پشتیبانی نمی‌کند.' };
  }

  const savedCredentialId = localStorage.getItem('mmba_biometric_credential_id');

  try {
    let challengeBuffer: ArrayBuffer;
    try {
      const challengeRes = await api.getBiometricChallenge();
      challengeBuffer = new TextEncoder().encode(challengeRes.challenge);
    } catch {
      challengeBuffer = crypto.getRandomValues(new Uint8Array(32));
    }

    const getOptions: CredentialRequestOptions = {
      publicKey: {
        challenge: challengeBuffer,
        timeout: 60000,
        userVerification: 'preferred',
        rpId: window.location.hostname || 'localhost',
        ...(savedCredentialId
          ? {
              allowCredentials: [
                {
                  id: base64UrlToBuffer(savedCredentialId),
                  type: 'public-key',
                },
              ],
            }
          : {}),
      },
    };

    const assertion = (await navigator.credentials.get(getOptions)) as PublicKeyCredential | null;

    if (!assertion) {
      return { success: false, message: 'احراز هویت بیومتریک انجام نشد.' };
    }

    const credentialId = bufferToBase64Url(assertion.rawId);

    // Call server to verify and obtain user session
    const res = await api.biometricLogin(credentialId);
    if (res.success && res.user) {
      return {
        success: true,
        user: res.user,
        token: res.token,
        message: res.message,
      };
    }

    return { success: false, message: res.message || 'اعتبارسنجی بیومتریک توسط سرور تایید نشد.' };
  } catch (err: any) {
    console.error('Biometric auth error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, message: 'احراز هویت بیومتریک لغو گردید.' };
    }
    return { success: false, message: err.message || 'خطا در فرآیند ورود بیومتریک.' };
  }
}
