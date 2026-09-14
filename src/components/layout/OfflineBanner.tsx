import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-50 bg-rose-600 text-white text-xs py-1.5 px-4 text-center font-medium shadow-md flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>ارتباط اینترنت قطع است — حالت آفلاین فعال است. تغییرات شما محلی ذخیره می‌شوند.</span>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 inset-x-0 z-50 bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-medium shadow-md flex items-center justify-center gap-2"
        >
          <Wifi className="w-4 h-4" />
          <span>اتصال اینترنت برقرار شد — همگام‌سازی اطلاعات در پس‌زمینه انجام گردید.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
