import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  Calendar,
  User,
  HardDrive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Attachment } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import {
  detectFileInfo,
  formatFileSize,
  getAttachmentSrc,
  downloadAttachment,
} from '../../lib/filePreviewUtils';

export interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
  /** Optional playlist/list of attachments to allow next/prev navigation */
  attachmentsList?: Attachment[];
  onNavigate?: (attachment: Attachment) => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  isOpen,
  onClose,
  attachment,
  attachmentsList = [],
  onNavigate,
}) => {
  const { t, isRtl } = useTranslation();

  // Viewer State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [hasCopiedText, setHasCopiedText] = useState(false);

  // Touch Pinch-to-Zoom State
  const touchDistanceRef = useRef<number | null>(null);
  const initialTouchScaleRef = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset transforms whenever attachment changes
  useEffect(() => {
    if (isOpen && attachment) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setLoadError(false);
      setIsLoading(true);
      setTextContent(null);
      setHasCopiedText(false);

      // Prevent background scrolling while modal is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Check if text/json file to decode
      const info = detectFileInfo(attachment);
      if (info.isText && attachment.dataUrl) {
        try {
          const commaIdx = attachment.dataUrl.indexOf(',');
          if (commaIdx !== -1) {
            const rawPayload = attachment.dataUrl.substring(commaIdx + 1);
            if (attachment.dataUrl.includes(';base64,')) {
              // Base64 decode supporting UTF-8
              const binary = atob(rawPayload);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const decoder = new TextDecoder('utf-8');
              setTextContent(decoder.decode(bytes));
            } else {
              setTextContent(decodeURIComponent(rawPayload));
            }
          }
        } catch {
          setTextContent(null);
        }
      }

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, attachment?.id, attachment?.dataUrl]);

  // Current active attachment & detection
  const currentAtt = attachment;
  const fileInfo = currentAtt ? detectFileInfo(currentAtt) : null;
  const originalFileName = currentAtt?.fileName || (currentAtt as any)?.filename || 'file';

  // Navigation helpers
  const currentIndex = attachmentsList.findIndex((a) => a.id === currentAtt?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < attachmentsList.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      onNavigate(attachmentsList[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, attachmentsList, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(attachmentsList[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, attachmentsList, onNavigate]);

  // Zoom helpers
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 4.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Keyboard Shortcuts (Esc, +, -, 0, f, d, Left, Right)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'd' || e.key === 'D') {
        if (currentAtt) {
          e.preventDefault();
          downloadAttachment(currentAtt);
        }
      } else if (e.key === 'ArrowRight') {
        if (isRtl) handlePrev();
        else handleNext();
      } else if (e.key === 'ArrowLeft') {
        if (isRtl) handleNext();
        else handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentAtt, onClose, isRtl, handlePrev, handleNext]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!fileInfo?.isImage) return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
    setScale((prev) => {
      const next = Math.max(0.5, Math.min(prev + zoomFactor, 4.0));
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  // Double Click / Double Tap to Zoom Toggle
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!fileInfo?.isImage) return;
    e.preventDefault();
    if (scale > 1.2) {
      handleResetZoom();
    } else {
      setScale(2.0);
    }
  };

  // Mouse Drag / Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || !fileInfo?.isImage) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile Touch Handlers (Pinch-to-zoom & Touch Pan)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!fileInfo?.isImage) return;

    if (e.touches.length === 2) {
      // Pinch gesture start
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      touchDistanceRef.current = dist;
      initialTouchScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // Touch pan start
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!fileInfo?.isImage) return;

    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      // Pinch zoom in progress
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const ratio = dist / touchDistanceRef.current;
      const nextScale = Math.max(0.5, Math.min(initialTouchScaleRef.current * ratio, 4.0));
      setScale(nextScale);
      if (nextScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Touch pan in progress
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    setIsDragging(false);
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setHasCopiedText(true);
      setTimeout(() => setHasCopiedText(false), 2000);
    }
  };

  if (!isOpen || !currentAtt || !fileInfo) return null;

  const previewSrc = getAttachmentSrc(currentAtt);
  const formattedSize = formatFileSize(currentAtt.fileSize);

  return (
    <AnimatePresence>
      <div
        ref={containerRef}
        id="attachment-preview-lightbox"
        className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-slate-100 select-none overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Header Toolbar */}
        <div
          id="preview-lightbox-header"
          className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800/80 z-20 gap-3"
        >
          {/* File Metadata Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* File Format Badge */}
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border tracking-wider shrink-0 ${fileInfo.colorClass}`}
            >
              {fileInfo.displayType}
            </span>

            {/* Filename & Details */}
            <div className="min-w-0 flex-1">
              <h2
                className="text-sm font-bold text-slate-100 truncate flex items-center gap-2"
                title={originalFileName}
              >
                <span>{originalFileName}</span>
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                <span>{formattedSize}</span>
                {currentAtt.createdAt && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {formatPersianDate(currentAtt.createdAt, false)}
                    </span>
                  </>
                )}
                {currentAtt.customerName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-indigo-400 truncate max-w-[150px]">
                      <User className="w-3 h-3" />
                      {currentAtt.customerName}
                    </span>
                  </>
                )}
                {attachmentsList.length > 1 && (
                  <>
                    <span>•</span>
                    <span className="text-slate-300 font-bold">
                      {currentIndex + 1} / {attachmentsList.length}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Controls (Images only) */}
            {fileInfo.isImage && !loadError && (
              <div className="flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/60 shadow-inner">
                <button
                  type="button"
                  id="preview-btn-zoom-out"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                  title={t('preview.zoomOut')}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span
                  id="preview-zoom-indicator"
                  onClick={handleResetZoom}
                  title={t('preview.resetZoom')}
                  className="text-[11px] font-mono font-bold px-2 text-slate-300 cursor-pointer hover:text-white transition-colors"
                >
                  {Math.round(scale * 100)}%
                </span>

                <button
                  type="button"
                  id="preview-btn-zoom-in"
                  onClick={handleZoomIn}
                  disabled={scale >= 4.0}
                  title={t('preview.zoomIn')}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {scale !== 1 && (
                  <button
                    type="button"
                    id="preview-btn-zoom-reset"
                    onClick={handleResetZoom}
                    title={t('preview.resetZoom')}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* External Tab / Native View */}
            <a
              id="preview-btn-external"
              href={previewSrc}
              target="_blank"
              rel="noopener noreferrer"
              title={t('preview.openInNewTab')}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/40 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              id="preview-btn-fullscreen"
              onClick={toggleFullscreen}
              title={isFullscreen ? t('preview.exitFullscreen') : t('preview.fullscreen')}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/40 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download Button */}
            <button
              type="button"
              id="preview-btn-download"
              onClick={() => downloadAttachment(currentAtt)}
              title={t('preview.download')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('preview.download')}</span>
            </button>

            {/* Close Lightbox Button */}
            <button
              type="button"
              id="preview-btn-close"
              onClick={onClose}
              title={t('preview.close')}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/40 border border-transparent transition-all ms-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Viewer Canvas / Main Viewport */}
        <div
          id="preview-viewport"
          className="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-6"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onMouseDown={handleMouseDown}
        >
          {/* Navigation Arrows for attachment playlist */}
          {hasPrev && (
            <button
              type="button"
              id="preview-btn-prev"
              onClick={handlePrev}
              className="absolute start-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-slate-900/80 text-white border border-slate-700/60 hover:bg-indigo-600 shadow-xl backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
              title={isRtl ? 'پیوست بعدی' : 'Previous Attachment'}
            >
              {isRtl ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
            </button>
          )}

          {hasNext && (
            <button
              type="button"
              id="preview-btn-next"
              onClick={handleNext}
              className="absolute end-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-slate-900/80 text-white border border-slate-700/60 hover:bg-indigo-600 shadow-xl backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
              title={isRtl ? 'پیوست قبلی' : 'Next Attachment'}
            >
              {isRtl ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
            </button>
          )}

          {/* 1. IMAGE PREVIEW */}
          {fileInfo.isImage && !loadError && (
            <div
              className={`relative flex items-center justify-center max-w-full max-h-full transition-transform ${
                scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
              }`}
              onDoubleClick={handleDoubleClick}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                    <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-xs text-slate-300">در حال بارگذاری تصویر...</span>
                  </div>
                </div>
              )}

              <img
                ref={imageRef}
                id="preview-active-image"
                src={previewSrc}
                alt={originalFileName}
                loading="eager"
                referrerPolicy="no-referrer"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setLoadError(true);
                }}
                className={`max-w-[92vw] max-h-[82vh] object-contain rounded-xl shadow-2xl transition-opacity duration-200 ${
                  isLoading ? 'opacity-0' : 'opacity-100'
                }`}
                draggable={false}
              />
            </div>
          )}

          {/* 2. PDF PREVIEW */}
          {fileInfo.isPdf && (
            <div className="w-full h-full max-w-6xl max-h-[86vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
              <iframe
                id="preview-pdf-iframe"
                src={`${previewSrc}#toolbar=1&navpanes=0`}
                title={originalFileName}
                className="w-full h-full border-0 bg-white"
              />
            </div>
          )}

          {/* 3. TEXT / CODE / CSV PREVIEW */}
          {fileInfo.isText && textContent !== null && (
            <div className="w-full h-full max-w-4xl max-h-[80vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800">
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  {originalFileName}
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {hasCopiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">{t('preview.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('preview.copyText')}</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-200 bg-slate-900/90 whitespace-pre-wrap select-text leading-relaxed">
                {textContent}
              </pre>
            </div>
          )}

          {/* 4. ERROR STATE (Unable to preview) */}
          {loadError && (
            <div
              id="preview-error-card"
              className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">
                  {t('preview.unableToPreview')}
                </h3>
                <p className="text-xs text-slate-400">
                  فایل ممکن است به دلیل فرمت یا ساختار رمزگذاری شده در مرورگر قابل نمایش مستقیم نباشد.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(false);
                    setIsLoading(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('preview.retry')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadAttachment(currentAtt)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('preview.download')}</span>
                </button>
              </div>
            </div>
          )}

          {/* 5. NON-PREVIEWABLE DOCUMENT HERO CARD (Doc, Excel, Zip, etc.) */}
          {!fileInfo.isImage && !fileInfo.isPdf && (!fileInfo.isText || textContent === null) && (
            <div
              id="preview-doc-card"
              className="max-w-lg w-full p-8 rounded-3xl bg-slate-900/95 border border-slate-800 text-center space-y-6 shadow-2xl backdrop-blur-xl"
            >
              {/* Type Icon */}
              <div className="relative mx-auto w-20 h-20 rounded-3xl flex items-center justify-center shadow-inner border border-slate-700/60 bg-slate-800/80">
                {fileInfo.isSpreadsheet && <FileSpreadsheet className="w-10 h-10 text-emerald-400" />}
                {fileInfo.isDocument && <FileText className="w-10 h-10 text-blue-400" />}
                {fileInfo.isArchive && <FileArchive className="w-10 h-10 text-amber-400" />}
                {!fileInfo.isSpreadsheet && !fileInfo.isDocument && !fileInfo.isArchive && (
                  <FileIcon className="w-10 h-10 text-slate-400" />
                )}
                <span className="absolute -bottom-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-950 border border-slate-700 text-slate-300">
                  {fileInfo.extension || 'FILE'}
                </span>
              </div>

              {/* Title & Metadata */}
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-100 break-all">{originalFileName}</h3>
                <p className="text-xs text-slate-400">
                  این نوع فایل ({fileInfo.mimeType || fileInfo.displayType}) نیاز به دانلود و بازگشایی در نرم‌افزار تخصصی دارد.
                </p>
              </div>

              {/* Metadata Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-end bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    حجم فایل:
                  </span>
                  <span className="font-mono font-bold text-slate-300">{formattedSize}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    تاریخ بارگذاری:
                  </span>
                  <span className="font-mono font-bold text-slate-300">
                    {currentAtt.createdAt ? formatPersianDate(currentAtt.createdAt, false) : '—'}
                  </span>
                </div>
              </div>

              {/* Download Action */}
              <div className="pt-2">
                <button
                  type="button"
                  id="preview-btn-card-download"
                  onClick={() => downloadAttachment(currentAtt)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>دریافت و دانلود فایل ({originalFileName})</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Helper Bar (for desktop zoom hints) */}
        {fileInfo.isImage && !loadError && (
          <div
            id="preview-lightbox-footer"
            className="hidden sm:flex items-center justify-between px-6 py-2 bg-slate-950/80 border-t border-slate-900 text-[11px] text-slate-500 z-20"
          >
            <div className="flex items-center gap-4">
              <span>{t('preview.doubleClickToZoom')}</span>
              <span>•</span>
              <span>{t('preview.dragToPan')}</span>
              <span>•</span>
              <span>اسکرول ماوس برای زوم</span>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span>کلیدهای میانبر: [+] [-] [0] [F] [Esc]</span>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
};
