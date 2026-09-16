import React, { useState, useEffect, useCallback } from 'react';
import { ChatConversation, ChatMessage, User, Attachment, ConversationType, UserRole } from '../../types';
import { storage } from '../../services/storage';
import { useTranslation } from '../../lib/i18n';
import { ChatConversationList } from './ChatConversationList';
import { ChatThread } from './ChatThread';
import { UserSearchModal } from './UserSearchModal';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupInfoModal } from './GroupInfoModal';
import { BroadcastModal } from './BroadcastModal';
import { MessageCircle, Megaphone } from 'lucide-react';

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
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const isAdmin = currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.OWNER || currentUser.role === UserRole.GOD || currentUser.role === UserRole.SUPERVISOR;

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const dirName = (c: ChatConversation) => {
    if (c.type === ConversationType.GROUP || c.type === 'GROUP') {
      return c.title || (isRtl ? 'گروه بدون نام' : 'Unnamed Group');
    }
    const other = (c.members || []).find((m) => m.user_id !== currentUser.id);
    if (other?.user_name) return other.user_name;
    const uid = (c.member_ids || []).find((id) => id !== currentUser.id);
    const u = allUsers.find((x) => x.id === uid);
    return u?.name || c.title || (isRtl ? 'گفتگو' : 'Conversation');
  };

  const isPinned = (c: ChatConversation): boolean => {
    const pins = c.pinned_by_user_ids || c.pinnedByUserIds || [];
    return pins.includes(currentUser.id);
  };

  const reloadThread = useCallback(() => {
    if (!activeConversationId) return;
    const msgs = storage.getChatMessagesForConversation(activeConversationId);
    setThreadMessages(msgs);
  }, [activeConversationId]);

  // Load thread when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setThreadMessages([]);
      return;
    }
    setLoadingThread(true);
    storage.markChatConversationRead(activeConversationId).then(() => onRefresh());
    reloadThread();
    setLoadingThread(false);
  }, [activeConversationId, reloadThread]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  };

  const handleSend = useCallback((
    body: string,
    msgAttachments?: { attachment_id: string; attachment_name: string; attachment_file_size?: number; attachment_file_type?: string }[]
  ) => {
    if (!activeConversationId) return;
    storage.sendChatMessage(activeConversationId, {
      body,
      body_text: body,
      attachments: msgAttachments,
    }).then(() => {
      onRefresh();
      reloadThread();
    });
  }, [activeConversationId, onRefresh, reloadThread]);

  const handleCreateConversation = (userId: string, userName?: string) => {
    storage.createConversation(userId, userName).then((conv) => {
      if (conv) {
        setActiveConversationId(conv.id);
        onRefresh();
      }
    });
  };

  const handleCreateGroup = (title: string, memberIds: string[], groupImageUrl?: string, priority?: string) => {
    storage.createGroupConversation(title, memberIds, groupImageUrl, priority).then((conv) => {
      if (conv) {
        setActiveConversationId(conv.id);
        onRefresh();
      }
    });
  };

  const handleTogglePin = (convId: string) => {
    storage.toggleConversationPin(convId).then(() => onRefresh());
  };

  const handleEditMessage = (messageId: string, newBody: string) => {
    if (!activeConversationId) return;
    storage.editChatMessage(activeConversationId, messageId, newBody).then(() => {
      reloadThread();
      onRefresh();
    });
  };

  const handleDeleteMessage = (messageId: string, reason: string) => {
    if (!activeConversationId) return;
    storage.softDeleteChatMessage(activeConversationId, messageId, reason).then(() => {
      reloadThread();
      onRefresh();
    });
  };

  const handleAttachDocument = (messageId: string, documentId: string) => {
    if (!activeConversationId) return;
    storage.attachDocumentToChatMessage(activeConversationId, messageId, documentId).then(() => {
      reloadThread();
      onRefresh();
    });
  };

  const handleAddGroupMember = (userId: string) => {
    if (!activeConversationId) return;
    storage.addGroupMember(activeConversationId, userId).then(() => {
      onRefresh();
    });
  };

  const handleRemoveGroupMember = (userId: string) => {
    if (!activeConversationId) return;
    storage.removeGroupMember(activeConversationId, userId).then(() => {
      onRefresh();
    });
  };

  const handleChangeGroupPriority = (priority: string) => {
    if (!activeConversationId) return;
    storage.setConversationPriority(activeConversationId, priority).then(() => {
      onRefresh();
    });
  };

  const handleArchiveGroup = () => {
    if (!activeConversationId) return;
    storage.archiveChatConversation(activeConversationId).then(() => {
      setActiveConversationId(null);
      onRefresh();
    });
  };

  return (
    <div className="flex h-[calc(100vh-160px)] min-h-[440px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      {/* Left: conversation list */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 shrink-0 border-e border-slate-200 dark:border-slate-800`}>
        <div className="w-full flex flex-col min-h-0">
          <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-500" />
                <span>{t('nav.chat') || (isRtl ? 'سامانه گفتگو و پیام‌رسانی' : 'Chat & Broadcast')}</span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">{isRtl ? 'ارتباط تیمی، گروه‌های کاری و اطلاعیه‌ها' : 'Team chat, groups & announcements'}</p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsBroadcastOpen(true)}
                title={isRtl ? 'ارسال پیام همگانی' : 'New Broadcast'}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRtl ? 'همگانی' : 'Broadcast'}</span>
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <ChatConversationList
              conversations={conversations}
              currentUserId={currentUser.id}
              activeConversationId={activeConversationId}
              onSelect={handleSelectConversation}
              onNewConversation={() => setIsUserSearchOpen(true)}
              onNewGroup={() => setIsCreateGroupOpen(true)}
              onTogglePin={handleTogglePin}
              onOpenBroadcast={() => setIsBroadcastOpen(true)}
              allUsers={allUsers}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>

      {/* Right: thread */}
      <div className={`${activeConversation ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
        {activeConversation ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Mobile back */}
            <div className="md:hidden p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <button type="button" onClick={() => setActiveConversationId(null)} className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                ← {isRtl ? 'بازگشت به لیست گفتگوها' : 'Back to conversations'}
              </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0">
              <ChatThread
                key={activeConversation.id}
                conversation={activeConversation}
                conversationTitle={dirName(activeConversation)}
                messages={threadMessages}
                currentUserId={currentUser.id}
                onSend={handleSend}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onAttachDocument={handleAttachDocument}
                onMarkRead={() => storage.markChatConversationRead(activeConversation.id)}
                onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
                onTogglePin={() => handleTogglePin(activeConversation.id)}
                isPinned={isPinned(activeConversation)}
                attachments={attachments}
                users={allUsers}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 space-y-3 p-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center">
              <MessageCircle className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              {isRtl ? 'برای شروع پیام‌رسانی، یک گفتگو را از لیست انتخاب کنید یا گفتگوی مستقیم یا گروهی جدید ایجاد فرمایید.' : 'Select a conversation or create a new direct or group chat to begin.'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <UserSearchModal
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
        users={allUsers}
        currentUserId={currentUser.id}
        onCreate={handleCreateConversation}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        users={allUsers}
        currentUserId={currentUser.id}
        onCreateGroup={handleCreateGroup}
      />

      {activeConversation && (
        <GroupInfoModal
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          conversation={activeConversation}
          currentUserId={currentUser.id}
          allUsers={allUsers}
          onAddMember={handleAddGroupMember}
          onRemoveMember={handleRemoveGroupMember}
          onChangePriority={handleChangeGroupPriority}
          onArchive={handleArchiveGroup}
        />
      )}

      <BroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        currentUser={currentUser}
        allUsers={allUsers}
        onBroadcastSent={() => onRefresh()}
      />
    </div>
  );
};
