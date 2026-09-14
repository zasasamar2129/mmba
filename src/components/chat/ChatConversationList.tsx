import React, { useState, useMemo } from 'react';
import { ChatConversation, User } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';
import { Search, MessageSquarePlus, MessageCircle } from 'lucide-react';

export interface ChatConversationListProps {
  conversations: (ChatConversation & { _unread?: number })[];
  currentUserId: string;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
  allUsers: User[];
}

export const ChatConversationList: React.FC<ChatConversationListProps> = ({
  conversations = [],
  currentUserId,
  activeConversationId,
  onSelect,
  onNewConversation,
  allUsers = [],
}) => {
  const { t, isRtl } = useTranslation();
  const [query, setQuery] = useState('');

  const otherUser = (c: ChatConversation): User | undefined => {
    const uid = (c.member_ids || []).find((id) => id !== currentUserId);
    return allUsers.find((x) => x.id === uid);
  };

  const dirName = (c: ChatConversation) => {
    const other = (c.members || []).find((m) => m.user_id !== currentUserId);
    if (other?.user_name) return other.user_name;
    const u = otherUser(c);
    return u?.name || c.title || (isRtl ? 'گفتگو' : 'Conversation');
  };

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return (conversations || [])
      .filter((c) => {
        if (!q) return true;
        return dirName(c).toLowerCase().includes(q) || (c.last_message || '').toLowerCase().includes(q);
      });
  }, [conversations, query, currentUserId, allUsers]);

  if (!conversations.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-sm font-bold">{isRtl ? 'گفتگوها' : 'Conversations'}</span>
          <button type="button" onClick={onNewConversation} title={isRtl ? 'گفتگوی جدید' : 'New'} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
          <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          <p className="text-xs">{isRtl ? 'برای شروع، گفتگوی جدید بسازید' : 'Start a new conversation to send messages'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">{isRtl ? 'گفتگوها' : 'Conversations'}</span>
          <button type="button" onClick={onNewConversation} title={isRtl ? 'گفتگوی جدید' : 'New'} className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60">
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRtl ? 'جستجو...' : 'Search...'}
            className="w-full text-xs px-8 py-2 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/70 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 p-2 min-h-0">
        {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{isRtl ? 'گفتگویی یافت نشد' : 'No conversations'}</p>}
        {filtered.map((c) => {
          const active = c.id === activeConversationId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-right transition-colors border ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/60'
              }`}
            >
              <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0 ring-2 ${active ? 'bg-white/20 text-white ring-white/40' : 'bg-gradient-to-tr from-indigo-600 to-sky-500 text-white ring-white dark:ring-slate-800'}`}>
                {(() => {
                  const u = otherUser(c);
                  if (u?.avatar) {
                    return <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />;
                  }
                  return dirName(c).charAt(0) || '?';
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{dirName(c)}</p>
                <p className={`text-[10px] truncate ${active ? 'text-white/80' : 'text-slate-400'}`}>
                  {(c.last_message_user_name ? c.last_message_user_name + ': ' : '') + (c.last_message || (isRtl ? 'بدون پیام' : 'No messages'))}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.last_message_at && (
                  <span className={`text-[9px] font-mono ${active ? 'text-white/80' : 'text-slate-400'}`}>
                    {formatPersianDate(c.last_message_at, true).split(' - ').pop()}
                  </span>
                )}
                {c._unread ? (
                  <Badge variant="danger" size="sm">{c._unread}</Badge>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};