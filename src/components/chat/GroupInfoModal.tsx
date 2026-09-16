import React, { useState } from 'react';
import { ChatConversation, User, ConversationPriority } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Users, UserPlus, UserMinus, Shield, ShieldCheck, Flag, Archive } from 'lucide-react';

export interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ChatConversation;
  currentUserId: string;
  allUsers: User[];
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onChangePriority: (priority: string) => void;
  onArchive: () => void;
}

export const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  allUsers = [],
  onAddMember,
  onRemoveMember,
  onChangePriority,
  onArchive,
}) => {
  const { isRtl } = useTranslation();
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [selectedNewUser, setSelectedNewUser] = useState('');

  const currentMembers = conversation.members || [];
  const memberIds = conversation.member_ids || [];

  const isOwner = (conversation.created_by_user_id || conversation.createdByUserId || conversation.created_by || conversation.createdById) === currentUserId;
  const currentMember = currentMembers.find((m) => m.user_id === currentUserId);
  const isAdmin = isOwner || currentMember?.role === 'ADMIN';

  const nonMembers = allUsers.filter(
    (u) => !memberIds.includes(u.id) && u.isActive !== false
  );

  const handleAdd = () => {
    if (!selectedNewUser) return;
    onAddMember(selectedNewUser);
    setSelectedNewUser('');
    setIsAddingMember(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={conversation.title || (isRtl ? 'اطلاعات گروه' : 'Group Info')}
      subtitle={`${memberIds.length} ${isRtl ? 'عضو' : 'members'} • ${isRtl ? 'ایجاد شده در' : 'Created at'} ${formatPersianDate(conversation.created_at)}`}
    >
      <div className="space-y-4">
        {/* Priority Setting */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isRtl ? 'سطح اولویت گروه:' : 'Group Priority:'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { key: 'NORMAL', label: isRtl ? 'عادی' : 'Normal', variant: 'default' as const },
              { key: 'IMPORTANT', label: isRtl ? 'مهم' : 'Important', variant: 'warning' as const },
              { key: 'VERY_IMPORTANT', label: isRtl ? 'بسیار مهم' : 'Critical', variant: 'danger' as const },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onChangePriority(p.key)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                  (conversation.priority || 'NORMAL') === p.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Member list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>{isRtl ? 'لیست اعضای گروه' : 'Members'}</span>
            </h4>
            {isAdmin && !isAddingMember && nonMembers.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsAddingMember(true)}
                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
              >
                {isRtl ? 'افزودن عضو جدید' : 'Add Member'}
              </Button>
            )}
          </div>

          {isAddingMember && (
            <div className="p-3 mb-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900 space-y-2">
              <label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
                {isRtl ? 'انتخاب همکار برای عضویت:' : 'Select user to add:'}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedNewUser}
                  onChange={(e) => setSelectedNewUser(e.target.value)}
                  className="flex-1 text-xs p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">{isRtl ? '-- انتخاب کاربر --' : '-- Select user --'}</option>
                  {nonMembers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
                <Button variant="primary" size="xs" onClick={handleAdd} disabled={!selectedNewUser}>
                  {isRtl ? 'تأیید' : 'Confirm'}
                </Button>
                <Button variant="outline" size="xs" onClick={() => setIsAddingMember(false)}>
                  {isRtl ? 'لغو' : 'Cancel'}
                </Button>
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {memberIds.map((uid) => {
              const u = allUsers.find((x) => x.id === uid);
              const m = currentMembers.find((mb) => mb.user_id === uid);
              const roleName = m?.role === 'OWNER'
                ? (isRtl ? 'مالک گروه' : 'Owner')
                : m?.role === 'ADMIN'
                ? (isRtl ? 'مدیر گروه' : 'Admin')
                : (isRtl ? 'عضو' : 'Member');
              const canRemove = isAdmin && uid !== currentUserId && m?.role !== 'OWNER';

              return (
                <div
                  key={uid}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {u?.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : (u?.name?.charAt(0) || '?')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {u?.name || m?.user_name || uid}
                        {uid === currentUserId && (
                          <span className="text-[10px] text-indigo-500 font-normal ms-1">({isRtl ? 'شما' : 'You'})</span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{u?.role || 'User'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={m?.role === 'OWNER' ? 'indigo' : m?.role === 'ADMIN' ? 'warning' : 'default'}
                      size="sm"
                    >
                      {roleName}
                    </Badge>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(uid)}
                        title={isRtl ? 'حذف از گروه' : 'Remove from group'}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => { onArchive(); onClose(); }}
            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            leftIcon={<Archive className="w-3.5 h-3.5" />}
          >
            {isRtl ? 'بایگانی / خروج از گروه' : 'Archive / Leave'}
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            {isRtl ? 'بستن' : 'Close'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
