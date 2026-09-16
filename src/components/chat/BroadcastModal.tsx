import React, { useState, useEffect } from 'react';
import { Broadcast, User } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Megaphone, Send, Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  allUsers: User[];
  onBroadcastSent?: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  onBroadcastSent,
}) => {
  const { isRtl } = useTranslation();
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'ALL' | 'SELECTED'>('ALL');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadBroadcasts = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.getBroadcasts();
      if (res.success && res.broadcasts) {
        setBroadcasts(res.broadcasts);
      }
    } catch (err: any) {
      console.error('Failed to load broadcasts:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBroadcasts();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!body.trim()) {
      setError(isRtl ? 'لطفاً متن پیام همگانی را وارد کنید.' : 'Please enter message content.');
      return;
    }
    if (targetType === 'SELECTED' && selectedUserIds.length === 0) {
      setError(isRtl ? 'لطفاً حداقل یک گیرنده انتخاب کنید.' : 'Please select at least one recipient.');
      return;
    }

    try {
      setSending(true);
      setError(null);
      const res = await api.createBroadcast({
        title: title.trim() || (isRtl ? 'اطلاعیه رسمی سیستم' : 'Official System Broadcast'),
        body: body.trim(),
        targetType,
        recipientUserIds: targetType === 'SELECTED' ? selectedUserIds : undefined,
      });

      if (res.success) {
        setSuccessMsg(
          isRtl
            ? `پیام همگانی با موفقیت برای ${res.recipientCount} کاربر ارسال شد.`
            : `Broadcast successfully sent to ${res.recipientCount} recipients.`
        );
        setTitle('');
        setBody('');
        setSelectedUserIds([]);
        loadBroadcasts();
        if (onBroadcastSent) onBroadcastSent();
        setTimeout(() => {
          setSuccessMsg(null);
          setActiveTab('HISTORY');
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ارسال پیام همگانی');
    } finally {
      setSending(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isRtl ? 'سیستم پیام همگانی (Broadcast)' : 'Broadcast System'}
      subtitle={isRtl ? 'ارسال اطلاعیه‌های فوری و اداری به تمام یا گروهی از کاربران' : 'Send official notifications to all or selected users'}
    >
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('NEW')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'NEW'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isRtl ? 'ارسال پیام جدید' : 'New Broadcast'}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('HISTORY'); loadBroadcasts(); }}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>{isRtl ? 'سوابق پیام‌های همگانی' : 'History'}</span>
            <Badge variant="default" size="sm">{broadcasts.length}</Badge>
          </button>
        </div>

        {activeTab === 'NEW' ? (
          <div className="space-y-3.5">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-700 dark:rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2 text-emerald-700 dark:emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'عنوان اطلاعیه' : 'Title'}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isRtl ? 'مثال: جلسه اضطراری هماهنگی، بروزرسانی بخشنامه...' : 'e.g., System Maintenance, Policy Update...'}
                rightIcon={<Megaphone className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'مخاطبان هدف' : 'Target Audience'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('ALL')}
                  className={`p-2.5 rounded-xl border text-right transition-all ${
                    targetType === 'ALL'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{isRtl ? 'تمام کاربران فعال' : 'All Active Users'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{isRtl ? 'ارسال به کل پرسنل سامانه' : 'Broadcast to entire organization'}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('SELECTED')}
                  className={`p-2.5 rounded-xl border text-right transition-all ${
                    targetType === 'SELECTED'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{isRtl ? 'انتخاب دست‌چین کاربران' : 'Selected Users'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{isRtl ? 'ارسال به کاربران خاص' : 'Pick specific recipients'}</p>
                </button>
              </div>
            </div>

            {targetType === 'SELECTED' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isRtl ? 'انتخاب کاربران گیرنده:' : 'Select Recipients:'} ({selectedUserIds.length} {isRtl ? 'نفر' : 'selected'})
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {allUsers.filter((u) => u.isActive !== false).map((u) => {
                    const selected = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUserSelection(u.id)}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${
                          selected ? 'bg-indigo-100 dark:bg-indigo-950/60 font-bold text-indigo-900 dark:text-indigo-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{u.name} ({u.role})</span>
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isRtl ? 'متن پیام همگانی' : 'Message Body'} <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setError(null); }}
                rows={4}
                placeholder={isRtl ? 'متن پیام، دستورالعمل یا اطلاعیه اداری خود را وارد فرمایید...' : 'Type official announcement content here...'}
                className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={onClose}>
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={sending || !body.trim()}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                {sending ? (isRtl ? 'در حال ارسال...' : 'Sending...') : (isRtl ? 'ارسال اطلاعیه همگانی' : 'Broadcast Now')}
              </Button>
            </div>
          </div>
        ) : (
          /* HISTORY TAB */
          <div className="space-y-3">
            {loadingHistory ? (
              <p className="text-xs text-slate-400 text-center py-8">{isRtl ? 'در حال دریافت سوابق...' : 'Loading...'}</p>
            ) : broadcasts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <Megaphone className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs">{isRtl ? 'تاکنون پیام همگانی ثبت نشده است.' : 'No broadcasts yet.'}</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                {broadcasts.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Megaphone className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{b.title}</span>
                      </h4>
                      <Badge variant={b.target_type === 'ALL' ? 'indigo' : 'default'} size="sm">
                        {b.target_type === 'ALL' ? (isRtl ? 'عمومی' : 'Public') : (isRtl ? 'انتخابی' : 'Selective')}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {b.body}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatPersianDate(b.created_at)}
                      </span>
                      <span>
                        {isRtl ? 'ارسال شده توسط:' : 'By:'} {b.sender_user_name || 'مدیر سامانه'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={onClose}>
                {isRtl ? 'بستن' : 'Close'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
