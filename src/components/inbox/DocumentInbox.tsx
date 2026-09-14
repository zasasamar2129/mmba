import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DocumentShare, DocumentShareStatus, Attachment, User } from '../../types';
import { storage } from '../../services/storage';
import { api } from '../../services/api';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Inbox, MailOpen, Mail, Archive, Eye, Search, User as UserIcon, Calendar,
  FileText, MessageSquare, ArrowLeftRight, Loader2
} from 'lucide-react';
import { AttachmentPreviewModal } from '../ui/AttachmentPreviewModal';

const PAGE_SIZE = 10;

export interface DocumentInboxProps {
  inboxItems: DocumentShare[];
  currentUser: User;
  attachments: Attachment[];
  onRefresh: () => void;
  onOpenAttachment?: (att: Attachment) => void;
}

export const DocumentInbox: React.FC<DocumentInboxProps> = ({
  inboxItems = [],
  currentUser,
  attachments = [],
  onRefresh,
}) => {
  const { success, error } = useToast();
  const { t, isRtl } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const myInbox = useMemo(() => {
    return inboxItems
      .filter((s) => s.status !== DocumentShareStatus.ARCHIVED)
      .filter((s) => s.recipientUserId === currentUser.id || s.recipient_user_id === currentUser.id)
      .filter((s) => {
        if (unreadOnly && s.status === DocumentShareStatus.READ) return false;
        return true;
      })
      .filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const sender = (s.senderUserName || s.sender_user_name || '').toLowerCase();
        const docName = (s.documentFileName || s.document_file_name || '').toLowerCase();
        const msg = (s.message || '').toLowerCase();
        return sender.includes(q) || docName.includes(q) || msg.includes(q);
      })
      .sort((a, b) => new Date(b.sharedAt || b.shared_at).getTime() - new Date(a.sharedAt || a.shared_at).getTime());
  }, [inboxItems, currentUser.id, unreadOnly, searchQuery]);

  const unreadCount = myInbox.filter((s) => s.status === DocumentShareStatus.SENT).length;

  // Pagination / lazy loading (Patch 05)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadedOnceRef = useRef(false);

  const visibleItems = myInbox.slice(0, visibleCount);
  const hasMore = serverTotal == null ? visibleCount < myInbox.length : visibleCount < serverTotal;

  // Query the paged server endpoint once to learn the authoritative total (metadata only)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getDocumentShares({ userId: currentUser.id, limit: 1 });
        if (res.success && res.shares) {
          setServerTotal(res.total);
        }
      } catch (e) { /* keep local fallback */ }
    })();
  }, [currentUser.id]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    // Simulate a light metadata fetch delay for skeleton visibility; actual paging
    // is from the already-cached list metadata (no file bytes downloaded).
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      setVisibleCount((v) => v + PAGE_SIZE);
      setIsLoadingMore(false);
      return;
    }
    try {
      const res = await api.getDocumentShares({ userId: currentUser.id, offset: visibleCount, limit: PAGE_SIZE });
      if (res.success && (res.shares?.length || 0) > 0) {
        setVisibleCount((v) => v + res.shares.length);
      } else {
        setServerTotal(myInbox.length);
      }
    } catch (e) {
      setVisibleCount((v) => v + PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, visibleCount, currentUser.id, myInbox.length]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [loadMore, visibleItems.length]);

  const SkeletonRow = () => (
    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700/60 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-1/2" />
        <div className="h-2.5 bg-slate-200 dark:bg-slate-700/40 rounded w-1/3" />
      </div>
      <div className="w-12 h-2.5 bg-slate-200 dark:bg-slate-700/40 rounded" />
    </div>
  );

  const skeletonRows = Array.from({ length: 4 }, (_, i) => <SkeletonRow key={`sk-${i}`} />);

  const getDocument = (share: DocumentShare): Attachment | null => {
    const id = share.documentId || share.document_id;
    return attachments.find((a) => a.id === id) || null;
  };

  const handleMarkRead = async (share: DocumentShare) => {
    try {
      await storage.markDocumentShareRead(share.id);
      onRefresh();
    } catch (err) {
      error(isRtl ? 'خطا در خواندن سند' : 'Error marking document as read');
    }
  };

  const handleArchive = async (share: DocumentShare) => {
    try {
      await storage.archiveDocumentShare(share.id);
      success(isRtl ? 'سند بایگانی شد' : 'Document archived');
      onRefresh();
    } catch (err) {
      error(isRtl ? 'خطا در بایگانی سند' : 'Error archiving document');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Inbox className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <span>{t('inbox.title')}</span>
            </h1>
            {unreadCount > 0 && (
              <Badge variant="rose" size="sm">
                {isRtl ? `${unreadCount} خوانده نشده` : `${unreadCount} unread`}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('inbox.subtitle')}
          </p>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl liquid-glass-card border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setUnreadOnly(false)}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
              !unreadOnly
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {isRtl ? 'همه' : 'All'}
          </button>
          <button
            type="button"
            onClick={() => setUnreadOnly(true)}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1 ${
              unreadOnly
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            {isRtl ? 'خوانده نشده' : 'Unread'}
          </button>
        </div>

        <div className="w-full md:w-72">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'جستجو در فرستنده یا نام سند...' : 'Search sender or document...'}
              className="w-full text-xs px-9 py-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Inbox List */}
      {myInbox.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-3xl liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
          <MailOpen className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{t('inbox.empty')}</h3>
          <p className="text-xs text-slate-500">
            {t('inbox.emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map((share) => {
            const isRead = share.status === DocumentShareStatus.READ;
            const doc = getDocument(share);
            return (
              <div
                key={share.id}
                className={`p-3.5 rounded-2xl border transition-all group ${
                  isRead
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isRead
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                      : 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                  }`}>
                    {isRead ? <MailOpen className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className={`text-sm font-bold truncate ${
                          isRead
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {share.documentFileName || share.document_file_name || t('inbox.openDocument')}
                        </h4>
                        {!isRead && (
                          <Badge variant="rose" size="sm">{t('inbox.unread')}</Badge>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {formatPersianDate(share.sharedAt || share.shared_at, true)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {isRtl ? 'فرستنده:' : 'Sender:'}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {share.senderUserName || share.sender_user_name}
                      </span>
                    </div>

                    {share.message && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <p className="line-clamp-2">{share.message}</p>
                      </div>
                    )}

                    {share.customerName || share.customer_name ? (
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        {share.customerName || share.customer_name}
                      </div>
                    ) : null}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      {doc ? (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={() => {
                            setPreviewAttachment(doc);
                            if (!isRead) handleMarkRead(share);
                          }}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          {t('inbox.openDocument')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled
                          leftIcon={<FileText className="w-3.5 h-3.5" />}
                        >
                          {isRtl ? 'سند یافت نشد' : 'Document not found'}
                        </Button>
                      )}

                      {!isRead && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleMarkRead(share)}
                          leftIcon={<MailOpen className="w-3.5 h-3.5" />}
                        >
                          {t('inbox.markRead')}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleArchive(share)}
                        leftIcon={<Archive className="w-3.5 h-3.5 text-slate-400" />}
                      >
                        {t('inbox.archive')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Skeleton while loading more */}
          {isLoadingMore && skeletonRows}

          {/* Infinite-scroll sentinel */}
          {hasMore && !isLoadingMore && (
            <div ref={sentinelRef} className="flex justify-center py-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
      />
    </div>
  );
};