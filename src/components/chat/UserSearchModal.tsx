import React, { useState, useMemo } from 'react';
import { User } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useTranslation } from '../../lib/i18n';
import { Search, UserPlus } from 'lucide-react';

export interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUserId: string;
  onCreate: (userId: string, userName?: string) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  users = [],
  currentUserId,
  onCreate,
}) => {
  const { t, isRtl } = useTranslation();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return (users || [])
      .filter((u) => u.id !== currentUserId && u.isActive !== false)
      .filter((u) => {
        if (!q) return true;
        return (u.name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
      })
      .slice(0, 30);
  }, [users, query, currentUserId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={isRtl ? 'شروع گفتگوی جدید' : 'New Conversation'}
      subtitle={isRtl ? 'انتخاب کاربر برای پیام مستقیم' : 'Pick a user to start a direct message'}
    >
      <div className="space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isRtl ? 'جستجو در نام یا نام کاربری...' : 'Search name or username...'}
          rightIcon={<Search className="w-4 h-4 text-slate-400" />}
        />
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {results.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">{isRtl ? 'کاربری یافت نشد' : 'No user found'}</p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => { onCreate(u.id, u.name); onClose(); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-colors text-end"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0 ring-2 ring-white dark:ring-slate-800">
                  {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : (u.name?.charAt(0) || '?')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{u.name}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">@{u.username}</p>
                </div>
                <UserPlus className="w-4 h-4 text-indigo-500 shrink-0" />
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>{isRtl ? 'انصراف' : 'Cancel'}</Button>
        </div>
      </div>
    </Modal>
  );
};