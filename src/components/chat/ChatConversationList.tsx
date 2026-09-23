import React, { useState, useMemo } from 'react';
import { ChatConversation, User, ConversationType, ChatMessage } from '../../types';
import { storage } from '../../services/storage';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';
import { Search, MessageSquarePlus, MessageCircle, Users, Pin, Megaphone, UserPlus, X } from 'lucide-react';

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
  const [typingMap, setTypingMap] = useState<Record<string, Array<{ userId: string; userName: string }>>>({});

  React.useEffect(() => {
    const updateAllTyping = () => {
      const map: Record<string, Array<{ userId: string; userName: string }>> = {};
      for (const conv of conversations) {
        const typers = storage.getTypingUsers(conv.id);
        if (typers.length > 0) {
          map[conv.id] = typers;
        }
      }
      setTypingMap(map);
    };

    updateAllTyping();
    const unsub = storage.subscribe((e) => {
      if (e.key === 'CHAT_TYPING') {
        updateAllTyping();
      }
    });

    const interval = setInterval(updateAllTyping, 2000);
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [conversations]);

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

  // Group messages by conversation ID for comprehensive message content and sender search
  const messagesByConv = useMemo(() => {
    const all = storage.getAllChatMessages();
    const map: Record<string, ChatMessage[]> = {};
    for (const m of all) {
      const cid = m.conversation_id || m.conversationId || '';
      if (!cid) continue;
      if (!map[cid]) map[cid] = [];
      map[cid].push(m);
    }
    return map;
  }, [conversations]);

  const searchResults = useMemo(() => {
    const q = (query || '').trim().toLowerCase();

    return (conversations || []).map((c) => {
      const convTitle = dirName(c);
      const titleMatch = (
        convTitle.toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.group_name || '').toLowerCase().includes(q)
      );

      // Search through participants / members
      const other = otherUser(c);
      const otherMatch = !!(other?.name && other.name.toLowerCase().includes(q));
      const membersMatch = (c.members || []).some(
        (m) => (m.user_name || m.userName || '').toLowerCase().includes(q)
      );
      const memberIdsUsersMatch = (c.member_ids || []).some((uid) => {
        const u = allUsers.find((x) => x.id === uid);
        return !!(u?.name && u.name.toLowerCase().includes(q));
      });
      const participantMatch = otherMatch || membersMatch || memberIdsUsersMatch;

      const lastMsgMatch = (c.last_message || '').toLowerCase().includes(q);
      const lastSenderMatch = (c.last_message_user_name || '').toLowerCase().includes(q);

      // Deep message search inside conversation (for matching content or sender name)
      const convMsgs = messagesByConv[c.id] || [];
      let matchedMsg: ChatMessage | null = null;
      let matchedBySender = false;
      let matchedByContent = false;

      if (q) {
        for (let i = convMsgs.length - 1; i >= 0; i--) {
          const m = convMsgs[i];
          const sender = (m.sender_user_name || m.senderUserName || '').toLowerCase();
          const body = (m.body || m.body_text || '').toLowerCase();
          if (sender.includes(q)) {
            matchedMsg = m;
            matchedBySender = true;
            break;
          }
          if (body.includes(q)) {
            matchedMsg = m;
            matchedByContent = true;
            break;
          }
        }
      }

      const matchesQuery = !q || titleMatch || participantMatch || lastMsgMatch || lastSenderMatch || !!matchedMsg;

      return {
        conversation: c,
        matchedMsg,
        matchedBySender,
        matchedByContent,
        titleMatch: !!q && titleMatch,
        participantMatch: !!q && participantMatch,
        matchesQuery,
      };
    }).filter(({ conversation: c, matchesQuery }) => {
      if (!matchesQuery) return false;
      // Tab filter
      if (filterTab === 'DIRECT' && (c.type === ConversationType.GROUP || c.type === 'GROUP')) return false;
      if (filterTab === 'GROUP' && c.type !== ConversationType.GROUP && c.type !== 'GROUP') return false;
      if (filterTab === 'PINNED' && !isPinned(c)) return false;

      return true;
    });
  }, [conversations, query, filterTab, currentUserId, allUsers, messagesByConv]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#10111d]">
      {/* Header with actions and Search Bar */}
      <div className="p-3 border-b border-slate-200 dark:border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{isRtl ? 'گفتگوها' : 'Conversations'}</span>
          <div className="flex items-center gap-1.5">
            {isAdmin && onOpenBroadcast && (
              <button
                type="button"
                onClick={onOpenBroadcast}
                title={isRtl ? 'پیام همگانی (Broadcast)' : 'Broadcast'}
                className="p-1.5 rounded-xl bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/25 border border-violet-500/20 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onNewGroup}
              title={isRtl ? 'ایجاد گروه جدید' : 'New Group'}
              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-500/20 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onNewConversation}
              title={isRtl ? 'گفتگوی مستقیم جدید' : 'New Direct Chat'}
              className="p-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs hover:opacity-95 transition-opacity"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Enhanced Search Bar: Filter by Title or Participant Name */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRtl ? 'جستجو بر اساس عنوان یا نام مخاطب / اعضا...' : 'Search by title or participant name...'}
            className="w-full text-xs ps-9 pe-8 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0c0d15] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title={isRtl ? 'پاک کردن جستجو' : 'Clear search'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {query && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <span>
              {isRtl
                ? `${searchResults.length} گفتگو منطبق با «${query}»`
                : `${searchResults.length} conversations matching "${query}"`}
            </span>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-violet-600 dark:text-violet-400 hover:underline"
            >
              {isRtl ? 'حذف فیلتر' : 'Reset'}
            </button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
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
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                filterTab === tab.key
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.09]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 p-2 min-h-0">
        {searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
            <MessageCircle className="w-9 h-9 text-slate-300 dark:text-slate-700" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {query
                ? (isRtl ? `هیچ گفتگویی با عنوان یا نام مخاطب «${query}» یافت نشد.` : `No conversations found with title or participant "${query}".`)
                : (isRtl ? 'گفتگویی یافت نشد.' : 'No conversations found.')}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-xs text-violet-600 dark:text-violet-400 font-semibold hover:underline"
              >
                {isRtl ? 'پاک کردن عبارت جستجو' : 'Clear search query'}
              </button>
            )}
          </div>
        ) : (
          searchResults.map(({ conversation: c, matchedMsg, matchedBySender, matchedByContent, titleMatch, participantMatch }) => {
            const active = c.id === activeConversationId;
            const isGrp = c.type === ConversationType.GROUP || c.type === 'GROUP';
            const pinned = isPinned(c);

            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full group/card flex items-center gap-2.5 p-2.5 rounded-2xl text-end transition-all cursor-pointer border ${
                  active
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-500 shadow-md shadow-violet-600/20'
                    : 'bg-white dark:bg-[#10111d] hover:bg-slate-50 dark:hover:bg-white/[0.04] border-slate-200 dark:border-white/[0.08]'
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
                        : 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white ring-white dark:ring-slate-800'
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-xs font-bold truncate ${active ? 'text-white' : 'text-slate-900 dark:text-slate-200'}`}>
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
                    {/* Match indicator pill */}
                    {query && participantMatch && (
                      <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${active ? 'bg-white/20 text-white' : 'bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'}`}>
                        {isRtl ? 'نام مخاطب' : 'Participant'}
                      </span>
                    )}
                    {query && titleMatch && !participantMatch && (
                      <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${active ? 'bg-white/20 text-white' : 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300'}`}>
                        {isRtl ? 'عنوان' : 'Title'}
                      </span>
                    )}
                  </div>

                  {/* Matching Snippet or Last Message or Active Typing */}
                  {typingMap[c.id] && typingMap[c.id].length > 0 ? (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] truncate animate-pulse">
                      <span className={`font-semibold flex items-center gap-1 ${active ? 'text-white' : 'text-violet-600 dark:text-violet-400'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                        {typingMap[c.id].map((t) => t.userName).join('، ')}:
                      </span>
                      <span className={`truncate ${active ? 'text-white/90' : 'text-violet-500 dark:text-violet-400 font-medium'}`}>
                        {isRtl ? 'در حال نوشتن...' : 'typing...'}
                      </span>
                    </div>
                  ) : query && matchedMsg ? (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] truncate">
                      <span className={`font-semibold shrink-0 ${active ? 'text-violet-200' : 'text-violet-600 dark:text-violet-400'}`}>
                        {matchedBySender ? (isRtl ? 'فرستنده: ' : 'Sender: ') : '💬 '}
                        {matchedMsg.sender_user_name || matchedMsg.senderUserName}:
                      </span>
                      <span className={`truncate ${active ? 'text-white/90' : 'text-slate-600 dark:text-slate-300'}`}>
                        {matchedMsg.body}
                      </span>
                    </div>
                  ) : (
                    <p className={`text-[10px] truncate mt-0.5 ${active ? 'text-white/80' : 'text-slate-400'}`}>
                      {(c.last_message_user_name ? c.last_message_user_name + ': ' : '') + (c.last_message || (isRtl ? 'بدون پیام' : 'No messages'))}
                    </p>
                  )}
                </div>

                {/* Meta & Pin Action */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="flex items-center gap-1">
                    {pinned && (
                      <Pin className={`w-3 h-3 ${active ? 'text-amber-300' : 'text-amber-500'} fill-current`} />
                    )}
                    {(matchedMsg?.created_at || c.last_message_at) && (
                      <span className={`text-[9px] font-mono ${active ? 'text-white/80' : 'text-slate-400'}`}>
                        {formatPersianDate(matchedMsg?.created_at || c.last_message_at, true).split(' - ').pop()}
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
