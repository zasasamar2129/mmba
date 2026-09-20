import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Check, Sparkles, X, RefreshCw, User as UserIcon, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';

export interface AvatarUploaderProps {
  currentAvatar?: string;
  userName: string;
  onAvatarChange: (avatarUrl: string | undefined) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showPresets?: boolean;
}

// Preset avatars curated for business and CRM environments (stored locally in /public/avatars/)
export const PRESET_AVATARS = [
  '/avatars/avatar-1.jpg',
  '/avatars/avatar-2.jpg',
  '/avatars/avatar-3.jpg',
  '/avatars/avatar-4.jpg',
  '/avatars/avatar-5.jpg',
  '/avatars/avatar-6.jpg',
  '/avatars/avatar-7.jpg',
  '/avatars/avatar-8.jpg',
];

/**
 * Resizes and compresses an image to a base64 DataURL (max 400x400)
 */
export const processImageFile = (file: File, maxDim = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Crop to square from center
        const minSide = Math.min(width, height);
        const startX = (width - minSide) / 2;
        const startY = (height - minSide) / 2;

        const targetDim = Math.min(minSide, maxDim);
        canvas.width = targetDim;
        canvas.height = targetDim;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Draw center square
        ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, targetDim, targetDim);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.readAsDataURL(file);
  });
};

export const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentAvatar,
  userName,
  onAvatarChange,
  size = 'lg',
  showPresets = true,
}) => {
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [previewAvatar, setPreviewAvatar] = useState<string | undefined>(currentAvatar);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-base',
    lg: 'w-24 h-24 text-2xl',
    xl: 'w-32 h-32 text-4xl',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await handleImageFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toastError('لطفاً یک فایل تصویری معتبر (JPG, PNG, WEBP) انتخاب فرمایید.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toastError('حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.');
      return;
    }

    try {
      setIsProcessing(true);
      const dataUrl = await processImageFile(file);
      setPreviewAvatar(dataUrl);
      onAvatarChange(dataUrl);
      success('تصویر پروفایل با موفقیت بارگذاری و تنظیم شد');
    } catch (err: any) {
      toastError(err.message || 'خطا در بارگذاری تصویر');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleImageFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewAvatar(undefined);
    onAvatarChange(undefined);
    success('تصویر پروفایل حذف شد');
  };

  // Webcam camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toastError('دسترسی به دوربین برقرار نشد. لطفاً مجوز دسترسی مرورگر را بررسی فرمایید.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const minSide = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 400;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const startX = (video.videoWidth - minSide) / 2;
      const startY = (video.videoHeight - minSide) / 2;
      // Mirror image horizontally for natural selfie experience
      ctx.translate(400, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, startX, startY, minSide, minSide, 0, 0, 400, 400);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setPreviewAvatar(dataUrl);
      onAvatarChange(dataUrl);
      success('عکس از دوربین با موفقیت ثبت و ذخیره شد');
    }
    stopCamera();
  };

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Main Avatar Display & Upload Trigger */}
      <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
        {/* Avatar Circle Container */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative ${sizeClasses[size]} rounded-2xl sm:rounded-full overflow-hidden border-2 cursor-pointer transition-all duration-200 shrink-0 select-none shadow-xl ${
            isDragging
              ? 'border-indigo-400 ring-4 ring-indigo-500/30 scale-105'
              : previewAvatar
              ? 'border-indigo-500/40 hover:border-indigo-400 ring-2 ring-indigo-500/10'
              : 'border-slate-700 hover:border-indigo-500/60 bg-gradient-to-tr from-slate-900 to-slate-800'
          }`}
        >
          {previewAvatar ? (
            <img
              src={previewAvatar}
              alt={userName}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-indigo-100 via-slate-100 to-indigo-50 dark:from-indigo-900/40 dark:via-slate-900 dark:to-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black">
              {userName ? userName.charAt(0) : <UserIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />}
            </div>
          )}

          {/* Hover Overlay with Camera Icon */}
          <div
            className={`absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-1 text-white transition-opacity duration-200 ${
              isHovered || isDragging ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            ) : (
              <>
                <Camera className="w-5 h-5 text-indigo-300" />
                <span className="text-[10px] font-bold text-white">تغییر تصویر</span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls & Instructions */}
        <div className="flex-1 text-center sm:text-end space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              isLoading={isProcessing}
            >
              آپلود تصویر جدید
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
              leftIcon={<Camera className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
            >
              ثبت با دوربین
            </Button>

            {previewAvatar && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleRemove}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                حذف تصویر
              </Button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            فرمت‌های مجاز: JPG, PNG, WEBP • فایل را به کادر بکشید یا دکمه آپلود را بزنید. (بهینه‌سازی خودکار تصویر)
          </p>
        </div>
      </div>

      {/* Live Camera Snapshot Modal / Drawer */}
      {isCameraActive && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-500/40 animate-blur-fade-up space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-sky-600 dark:text-sky-400 animate-pulse" />
              <span>ثبت مستقیم تصویر از وب‌کم</span>
            </span>
            <button
              type="button"
              onClick={stopCamera}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute inset-0 border-2 border-dashed border-white/30 pointer-events-none rounded-2xl m-4" />
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" type="button" onClick={stopCamera}>
              انصراف
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={capturePhoto}
              leftIcon={<Camera className="w-4 h-4" />}
            >
              عکس بگیر و تنظیم کن
            </Button>
          </div>
        </div>
      )}

      {/* Preset Avatars Selection */}
      {showPresets && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>یا یکی از آواتارهای پیشنهادی را انتخاب کنید:</span>
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80">
            {PRESET_AVATARS.map((presetUrl, idx) => {
              const isSelected = previewAvatar === presetUrl;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPreviewAvatar(presetUrl);
                    onAvatarChange(presetUrl);
                    success('آواتار انتخابی تنظیم شد');
                  }}
                  className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    isSelected
                      ? 'border-indigo-400 ring-2 ring-indigo-500/40 scale-105'
                      : 'border-slate-800 hover:border-indigo-500/50 hover:scale-105'
                  }`}
                >
                  <img
                    src={presetUrl}
                    alt={`Avatar ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:brightness-110 transition-all"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-600/50 backdrop-blur-xs flex items-center justify-center">
                      <Check className="w-4 h-4 text-white drop-shadow" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
