import React, { useState, useMemo } from 'react';
import { ChatConversation, User, ConversationType } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';
import { Search, MessageSquarePlus, MessageCircle, Users, Pin, Megaphone, UserPlus } from 'lucide-react';

export interface ChatConversationListProps {
  conversations: (ChatConversation & { _unread?: number })[];
  currentUserId: string;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  onNewGroup: () => void;
  onTogglePin: (id: string) => void;
  onOpenBroadcast?: () => void;
  allUsers: User[];
  isAdmin?: boolean;
}

export const ChatConversationList: React.FC<ChatConversationListProps> = ({
  conversations = [],
  currentUserId,
  activeConversationId,
  onSelect,
  onNewConversation,
  onNewGroup,
  onTogglePin,
  onOpenBroadcast,
  allUsers = [],
  isAdmin = false,
}) => {
  const { isRtl } = useTranslation();
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'DIRECT' | 'GROUP' | 'PINNED'>('ALL');

  const otherUser = (c: ChatConversation): User | undefined => {
    const uid = (c.member_ids || []).find((id) => id !== currentUserId);
    return allUsers.find((x) => x.id === uid);
  };

  const dirName = (c: ChatConversation) => {
    if (c.type === ConversationType.GROUP || c.type === 'GROUP') {
      return c.title || (isRtl ? 'گروه بدون نام' : 'Unnamed Group');
    }
    const other = (c.members || []).find((m) => m.user_id !== currentUserId);
    if (other?.user_name) return other.user_name;
    const u = otherUser(c);
    return u?.name || c.title || (isRtl ? 'گفتگو' : 'Conversation');
  };

  const isPinned = (c: ChatConversation): boolean => {
    const pins = c.pinned_by_user_ids || c.pinnedByUserIds || [];
    return pins.includes(currentUserId);
  };

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return (conversations || []).filter((c) => {
      // Tab filter
      if (filterTab === 'DIRECT' && (c.type === ConversationType.GROUP || c.type === 'GROUP')) return false;
      if (filterTab === 'GROUP' && c.type !== ConversationType.GROUP && c.type !== 'GROUP') return false;
      if (filterTab === 'PINNED' && !isPinned(c)) return false;

      // Search query
      if (!q) return true;
      return dirName(c).toLowerCase().includes(q) || (c.last_message || '').toLowerCase().includes(q);
    });
  }, [conversations, query, filterTab, currentUserId, allUsers]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with actions */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{isRtl ? 'گفتگوها' : 'Conversations'}</span>
          <div className="flex items-center gap-1">
            {isAdmin && onOpenBroadcast && (
              <button
                type="button"
                onClick={onOpenBroadcast}
                title={isRtl ? 'پیام همگانی (Broadcast)' : 'Broadcast'}
                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onNewGroup}
              title={isRtl ? 'ایجاد گروه جدید' : 'New Group'}
              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onNewConversation}
              title={isRtl ? 'گفتگوی مستقیم جدید' : 'New Direct Chat'}
              className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRtl ? 'جستجو در گفتگوها...' : 'Search...'}
            className="w-full text-xs px-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
          {[
            { key: 'ALL', label: isRtl ? 'همه' : 'All' },
            { key: 'DIRECT', label: isRtl ? 'مستقیم' : 'Direct' },
            { key: 'GROUP', label: isRtl ? 'گروه‌ها' : 'Groups' },
            { key: 'PINNED', label: isRtl ? 'پین‌شده' : 'Pinned' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterTab(tab.key as any)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                filterTab === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 p-2 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
            <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs">{isRtl ? 'گفتگویی یافت نشد.' : 'No conversations found.'}</p>
          </div>
        ) : (
          filtered.map((c) => {
            const active = c.id === activeConversationId;
            const isGrp = c.type === ConversationType.GROUP || c.type === 'GROUP';
            const pinned = isPinned(c);

            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full group/card flex items-center gap-2.5 p-2.5 rounded-xl text-right transition-all cursor-pointer border ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-xs font-bold ring-2 ${
                      active
                        ? 'bg-white/20 text-white ring-white/40'
                        : isGrp
                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-white dark:ring-slate-800'
                        : 'bg-gradient-to-tr from-indigo-600 to-sky-500 text-white ring-white dark:ring-slate-800'
                    }`}
                  >
                    {isGrp ? (
                      <Users className="w-5 h-5" />
                    ) : (() => {
                      const u = otherUser(c);
                      if (u?.avatar) {
                        return <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />;
                      }
                      return dirName(c).charAt(0) || '?';
                    })()}
                  </div>
                  {isGrp && (
                    <span className="absolute -bottom-1 -end-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[8px] text-white">
                      •
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                      {dirName(c)}
                    </p>
                    {c.priority === 'VERY_IMPORTANT' && (
                      <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${active ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'}`}>
                        {isRtl ? 'فوری' : 'Urgent'}
                      </span>
                    )}
                    {c.priority === 'IMPORTANT' && (
                      <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${active ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                        {isRtl ? 'مهم' : 'Important'}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] truncate mt-0.5 ${active ? 'text-white/80' : 'text-slate-400'}`}>
                    {(c.last_message_user_name ? c.last_message_user_name + ': ' : '') + (c.last_message || (isRtl ? 'بدون پیام' : 'No messages'))}
                  </p>
                </div>

                {/* Meta & Pin Action */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-1">
                    {pinned && (
                      <Pin className={`w-3 h-3 ${active ? 'text-amber-300' : 'text-amber-500'} fill-current`} />
                    )}
                    {c.last_message_at && (
                      <span className={`text-[9px] font-mono ${active ? 'text-white/80' : 'text-slate-400'}`}>
                        {formatPersianDate(c.last_message_at, true).split(' - ').pop()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {c._unread ? (
                      <Badge variant="danger" size="sm">{c._unread}</Badge>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(c.id);
                      }}
                      title={pinned ? (isRtl ? 'برداشتن پین' : 'Unpin') : (isRtl ? 'پین کردن گفتگو' : 'Pin')}
                      className={`p-1 rounded hover:bg-black/10 transition-colors opacity-0 group-hover/card:opacity-100 ${
                        pinned ? '!opacity-100' : ''
                      }`}
                    >
                      <Pin className={`w-3 h-3 ${active ? 'text-white/80' : 'text-slate-400'}`} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
