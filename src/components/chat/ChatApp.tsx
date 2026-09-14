import React, { useState, useEffect, useCallback } from 'react';
import { ChatConversation, ChatMessage, User, Attachment } from '../../types';
import { storage } from '../../services/storage';
import { useTranslation } from '../../lib/i18n';
import { ChatConversationList } from './ChatConversationList';
import { ChatThread } from './ChatThread';
import { UserSearchModal } from './UserSearchModal';
import { MessageCircle } from 'lucide-react';

export interface ChatAppProps {
  conversations: (ChatConversation & { _unread?: number })[];
  currentUser: User;
  allUsers: User[];
  attachments: Attachment[];
  onRefresh: () => void;
}

export const ChatApp: React.FC<ChatAppProps> = ({
  conversations = [],
  currentUser,
  allUsers = [],
  attachments = [],
  onRefresh,
}) => {
  const { t, isRtl } = useTranslation();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const dirName = (c: ChatConversation) => {
    const other = (c.members || []).find((m) => m.user_id !== currentUser.id);
    if (other?.user_name) return other.user_name;
    const uid = (c.member_ids || []).find((id) => id !== currentUser.id);
    const u = allUsers.find((x) => x.id === uid);
    return u?.name || c.title || (isRtl ? 'گفتگو' : 'Conversation');
  };

  // Load thread when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setThreadMessages([]);
      return;
    }
    setLoadingThread(true);
    storage.markChatConversationRead(activeConversationId).then(() => onRefresh());
    const msgs = storage.getChatMessagesForConversation(activeConversationId);
    setThreadMessages(msgs);
    setLoadingThread(false);
  }, [activeConversationId, conversations.length]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const handleSend = useCallback((body: string) => {
    if (!activeConversationId) return;
    storage.sendChatMessage(activeConversationId, { body, body_text: body }).then(() => {
      onRefresh();
      setThreadMessages(storage.getChatMessagesForConversation(activeConversationId));
    });
  }, [activeConversationId, onRefresh]);

  const handleCreateConversation = (userId: string, userName?: string) => {
    storage.createConversation(userId, userName).then((conv) => {
      if (conv) {
        setActiveConversationId(conv.id);
        onRefresh();
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      {/* Left: conversation list */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80 shrink-0 border-e border-slate-200 dark:border-slate-800`}>
        <div className="w-full flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-500" />
              <span>{t('nav.chat') || (isRtl ? 'گفتگوها' : 'Chat')}</span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{isRtl ? 'پیام‌رسانی داخلی بین همکاران' : 'Internal messaging between colleagues'}</p>
          </div>
          <div className="flex-1 min-h-0">
            <ChatConversationList
              conversations={conversations}
              currentUserId={currentUser.id}
              activeConversationId={activeConversationId}
              onSelect={handleSelectConversation}
              onNewConversation={() => setIsUserSearchOpen(true)}
              allUsers={allUsers}
            />
          </div>
        </div>
      </div>

      {/* Right: thread */}
      <div className={`${activeConversation ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
        {activeConversation ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Mobile back */}
            <div className="md:hidden p-2 border-b border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setActiveConversationId(null)} className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                ← {isRtl ? 'بازگشت به گفتگوها' : 'Back'}
              </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0">
              <ChatThread
                key={activeConversation.id}
                conversationTitle={dirName(activeConversation)}
                messages={threadMessages}
                currentUserId={currentUser.id}
                onSend={handleSend}
                onMarkRead={() => storage.markChatConversationRead(activeConversation.id)}
                attachments={attachments}
                users={allUsers}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 space-y-3 p-8">
            <MessageCircle className="w-12 h-12" />
            <p className="text-xs text-slate-400">{isRtl ? 'یک گفتگو را انتخاب کنید یا گفتگوی جدید بسازید' : 'Select a conversation or start a new one'}</p>
          </div>
        )}
      </div>

      <UserSearchModal
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
        users={allUsers}
        currentUserId={currentUser.id}
        onCreate={handleCreateConversation}
      />
    </div>
  );
};