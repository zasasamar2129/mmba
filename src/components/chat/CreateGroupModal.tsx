import React, { useState, useMemo } from 'react';
import { User, ConversationPriority } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useTranslation } from '../../lib/i18n';
import { Search, Users, Check, AlertCircle } from 'lucide-react';

export interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUserId: string;
  onCreateGroup: (title: string, memberIds: string[], groupImageUrl?: string, priority?: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  users = [],
  currentUserId,
  onCreateGroup,
}) => {
  const { isRtl } = useTranslation();
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<string>('NORMAL');
  const [error, setError] = useState<string | null>(null);

  const availableUsers = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return (users || [])
      .filter((u) => u.id !== currentUserId && u.isActive !== false)
      .filter((u) => {
        if (!q) return true;
        return (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
      });
  }, [users, query, currentUserId]);

  const toggleUser = (userId: string) => {
    setError(null);
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = () => {
    if (!title.trim()) {
      setError(isRtl ? 'لطفاً نام گروه را وارد کنید.' : 'Please enter group name.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError(isRtl ? 'لطفاً حداقل یک عضو برای گروه انتخاب کنید.' : 'Please select at least one member.');
      return;
    }

    onCreateGroup(title.trim(), selectedUserIds, undefined, priority);
    setTitle('');
    setSelectedUserIds([]);
    setPriority('NORMAL');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={isRtl ? 'ایجاد گروه گفتگوی جدید' : 'Create New Group'}
      subtitle={isRtl ? 'گفتگوی چندنفره تیمی برای همکاری و هماهنگی پروژه‌ها' : 'Multi-member conversation for team collaboration'}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-700 dark:rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'نام گروه' : 'Group Name'} <span className="text-rose-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(null); }}
            placeholder={isRtl ? 'مثال: تیم فروش، هماهنگی قراردادها...' : 'e.g., Sales Team, Contract Operations...'}
            rightIcon={<Users className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {isRtl ? 'اولویت گفتگو' : 'Conversation Priority'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'NORMAL', label: isRtl ? 'عادی' : 'Normal', desc: isRtl ? 'مکالمات روزمره' : 'Standard' },
              { key: 'IMPORTANT', label: isRtl ? 'مهم' : 'Important', desc: isRtl ? 'پیگیری اولویت‌دار' : 'Follow-up' },
              { key: 'VERY_IMPORTANT', label: isRtl ? 'بسیار مهم' : 'Critical', desc: isRtl ? 'فوری و حساس' : 'Urgent' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(p.key)}
                className={`p-2.5 rounded-xl border text-right transition-all ${
                  priority === p.key
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{p.label}</span>
                  {priority === p.key && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isRtl ? 'انتخاب اعضای گروه' : 'Select Members'} ({selectedUserIds.length} {isRtl ? 'نفر انتخاب شده' : 'selected'})
            </label>
            {selectedUserIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedUserIds([])}
                className="text-[10px] text-indigo-600 hover:underline"
              >
                {isRtl ? 'پاک کردن انتخاب‌ها' : 'Clear selection'}
              </button>
            )}
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRtl ? 'جستجوی کاربر بر اساس نام یا نام کاربری...' : 'Search user...'}
            rightIcon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {availableUsers.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">{isRtl ? 'کاربری یافت نشد' : 'No users found'}</p>
            ) : (
              availableUsers.map((u) => {
                const selected = selectedUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-right ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
                    }`}>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : (u.name?.charAt(0) || '?')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">@{u.username} • {u.role}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            {isRtl ? 'انصراف' : 'Cancel'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate} disabled={!title.trim() || selectedUserIds.length === 0}>
            {isRtl ? 'ایجاد گروه گفتگو' : 'Create Group'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
