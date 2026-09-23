import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Attachment, User, ChatConversation, ConversationType, MessageStatus } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { AttachmentPreviewModal } from '../ui/AttachmentPreviewModal';
import { AttachDocumentModal } from './AttachDocumentModal';
import { DeleteMessageModal } from './DeleteMessageModal';
import { storage } from '../../services/storage';
import { uploadManager } from '../../lib/uploadManager';
import {
  Send, Paperclip, Users, Edit2, Trash2,
  X, Check, CheckCheck, Clock, AlertCircle, FileText, Pin, Info, SmilePlus, Smartphone, Loader2
} from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👏', '😂', '😮', '😢', '🎉', '✅'];

export interface ChatThreadProps {
  conversation: ChatConversation;
  conversationTitle: string;
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (body: string, attachments?: { attachment_id: string; attachment_name: string; attachment_file_size?: number; attachment_file_type?: string }[]) => void;
  onEditMessage: (messageId: string, newBody: string) => void;
  onDeleteMessage: (messageId: string, reason: string) => void;
  onAttachDocument: (messageId: string, documentId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onMarkRead: () => void;
  onOpenGroupInfo?: () => void;
  onTogglePin?: () => void;
  isPinned?: boolean;
  attachments: Attachment[];
  users?: User[];
  isAdmin?: boolean;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  conversation,
  conversationTitle,
  messages = [],
  currentUserId,
  onSend,
  onEditMessage,
  onDeleteMessage,
  onAttachDocument,
  onToggleReaction,
  onMarkRead,
  onOpenGroupInfo,
  onTogglePin,
  isPinned = false,
  attachments = [],
  users = [],
  isAdmin = false,
}) => {
  const { isRtl } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [isDeviceUploading, setIsDeviceUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceFileInputRef = useRef<HTMLInputElement>(null);

  const isGroup = conversation.type === ConversationType.GROUP || conversation.type === 'GROUP';

  // Real-time typing indicators sync
  useEffect(() => {
    const updateTyping = () => {
      if (conversation?.id) {
        const active = storage.getTypingUsers(conversation.id);
        setTypingUsers(active);
      }
    };

    updateTyping();

    // Subscribe to storage changes for typing and message updates
    const unsubscribe = storage.subscribe((event) => {
      if (event.key === 'CHAT_TYPING') {
        const payloadConvId = (event.payload as any)?.conversationId;
        if (!payloadConvId || payloadConvId === conversation.id) {
          updateTyping();
        }
      }
    });

    // Heartbeat to prune inactive typing sessions
    const interval = setInterval(updateTyping, 2000);

    return () => {
      clearInterval(interval);
      unsubscribe();
      if (conversation?.id) {
        storage.setTyping(conversation.id, false);
      }
    };
  }, [conversation?.id]);

  // Mark delivered and read when viewing conversation
  useEffect(() => {
    if (conversation?.id) {
      storage.markChatConversationDelivered(conversation.id);
      onMarkRead();
    }
  }, [conversation?.id, messages.length, onMarkRead]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationTitle, typingUsers.length]);

  const handleDeviceFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsDeviceUploading(true);
    const file = files[0];

    uploadManager
      .upload(file, {
        onSuccess: (saved) => {
          setPendingAttachments((prev) => [...prev, saved]);
          toastSuccess(isRtl ? `فایل «${saved.fileName}» آپلود و تأیید شد` : `"${saved.fileName}" uploaded and confirmed`);
          setIsDeviceUploading(false);
        },
        onError: (err) => {
          toastError(isRtl ? `خطا در آپلود: ${err}` : `Upload error: ${err}`);
          setIsDeviceUploading(false);
        },
      });
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraft(val);

    if (conversation?.id) {
      if (val.trim().length > 0) {
        storage.setTyping(conversation.id, true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          if (conversation?.id) {
            storage.setTyping(conversation.id, false);
          }
        }, 2500);
      } else {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        storage.setTyping(conversation.id, false);
      }
    }
  };

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    if (conversation?.id) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      storage.setTyping(conversation.id, false);
    }

    const attPayload = pendingAttachments.map((a) => ({
      attachment_id: a.id,
      attachment_name: a.fileName,
      attachment_file_size: a.fileSize,
      attachment_file_type: a.fileType,
    }));

    onSend(trimmed, attPayload.length > 0 ? attPayload : undefined);
    setDraft('');
    setPendingAttachments([]);
    composerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleStartEdit = (m: ChatMessage) => {
    setEditingMessage(m);
    setEditDraft(m.body || '');
    setActiveReactionPickerMessageId(null);
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editDraft.trim()) return;
    onEditMessage(editingMessage.id, editDraft.trim());
    setEditingMessage(null);
    setEditDraft('');
  };

  const resolveAtt = (ref: { attachment_id?: string; attachmentId?: string; attachment_name?: string; attachmentName?: string }) => {
    const id = ref.attachment_id || ref.attachmentId || '';
    return attachments.find((a) => a.id === id);
  };

  const senderInfo = (m: ChatMessage): User | undefined => {
    const sid = m.sender_user_id || m.senderUserId || '';
    return users.find((u) => u.id === sid);
  };

  const getGroupedReactions = (m: ChatMessage) => {
    const list = m.reactions || [];
    const map = new Map<string, { count: number; users: string[]; reactedByMe: boolean }>();
    for (const r of list) {
      const em = r.emoji;
      if (!em) continue;
      const uid = r.userId || r.user_id || '';
      const uName = r.userName || r.user_name || (users || []).find((u) => u.id === uid)?.name || (isRtl ? 'کاربر' : 'User');
      const isMe = uid === currentUserId;
      const entry = map.get(em) || { count: 0, users: [], reactedByMe: false };
      entry.count += 1;
      entry.users.push(isMe ? (isRtl ? 'شما' : 'You') : uName);
      if (isMe) entry.reactedByMe = true;
      map.set(em, entry);
    }
    return Array.from(map.entries()).map(([emoji, data]) => ({
      emoji,
      ...data,
    }));
  };

  // Helper to format typing text for groups and direct conversations
  const renderTypingText = () => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map((u) => u.userName || (isRtl ? 'همکار' : 'User'));

    if (isRtl) {
      if (names.length === 1) {
        return `${names[0]} در حال نوشتن است...`;
      } else if (names.length === 2) {
        return `${names[0]} و ${names[1]} در حال نوشتن هستند...`;
      } else {
        return `${names[0]}، ${names[1]} و ${names.length - 2} نفر دیگر در حال نوشتن هستند...`;
      }
    } else {
      if (names.length === 1) {
        return `${names[0]} is typing...`;
      } else if (names.length === 2) {
        return `${names[0]} and ${names[1]} are typing...`;
      } else {
        return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50/50 dark:bg-[#0c0d15]">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-white/80 dark:bg-[#10111d]/90 backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
            isGroup ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' : 'bg-gradient-to-tr from-indigo-600 to-sky-500'
          }`}>
            {isGroup ? <Users className="w-5 h-5" /> : conversationTitle.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {conversationTitle}
              </h3>
              {conversation.priority === 'VERY_IMPORTANT' && (
                <Badge variant="danger" size="sm">{isRtl ? 'بسیار مهم' : 'Critical'}</Badge>
              )}
              {conversation.priority === 'IMPORTANT' && (
                <Badge variant="warning" size="sm">{isRtl ? 'مهم' : 'Important'}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              <span>
                {isGroup
                  ? `${(conversation.member_ids || []).length} ${isRtl ? 'عضو گروه' : 'members'}`
                  : isRtl ? 'گفتگوی مستقیم خصوصی' : 'Direct Conversation'}
              </span>
              <span>•</span>
              <span>
                {(messages || []).length} {isRtl ? 'پیام' : 'messages'}
              </span>
              {typingUsers.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-violet-500 dark:text-violet-400 font-semibold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                    {renderTypingText()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? (isRtl ? 'برداشتن پین' : 'Unpin') : (isRtl ? 'پین کردن گفتگو' : 'Pin')}
              className={`p-1.5 rounded-lg border transition-all ${
                isPinned
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-600 dark:text-amber-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
          )}

          {isGroup && onOpenGroupInfo && (
            <Button
              variant="outline"
              size="xs"
              onClick={onOpenGroupInfo}
              leftIcon={<Info className="w-3.5 h-3.5" />}
            >
              {isRtl ? 'اطلاعات گروه' : 'Group Info'}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 bg-slate-50/60 dark:bg-slate-950/40">
        {(messages || []).length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400 space-y-1">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p>{isRtl ? 'هنوز پیامی در این گفتگو ارسال نشده است.' : 'No messages yet.'}</p>
          </div>
        )}

        {(messages || []).map((m) => {
          const mine = m.sender_user_id === currentUserId || m.senderUserId === currentUserId;
          const sender = senderInfo(m);
          const isDeleted = Boolean(m.is_deleted || m.isDeleted);
          const isEdited = Boolean(m.is_edited || m.isEdited);
          const canDelete = mine || isAdmin;
          const canEdit = mine && !isDeleted;
          const groupedReactions = getGroupedReactions(m);

          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2 group/msg relative`}>
              {!mine && (
                <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 ring-2 ring-white dark:ring-white/[0.1] shadow-xs mt-0.5">
                  {sender?.avatar ? (
                    <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                      {(m.sender_user_name || '?').charAt(0)}
                    </div>
                  )}
                </div>
              )}

              <div className="relative max-w-[82%] sm:max-w-[70%]">
                {/* Floating Reaction Picker Popover */}
                {activeReactionPickerMessageId === m.id && !isDeleted && (
                  <div
                    className={`absolute z-30 -top-10 ${
                      mine ? 'end-0' : 'start-0'
                    } flex items-center gap-1 px-2 py-1 rounded-2xl bg-white/95 dark:bg-[#151726]/95 backdrop-blur-md shadow-2xl border border-slate-200 dark:border-white/[0.15] animate-in fade-in zoom-in-95 duration-150`}
                  >
                    {QUICK_EMOJIS.map((emoji) => {
                      const hasReacted = (m.reactions || []).some(
                        (r) => r.emoji === emoji && (r.userId === currentUserId || r.user_id === currentUserId)
                      );
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            if (onToggleReaction) onToggleReaction(m.id, emoji);
                            setActiveReactionPickerMessageId(null);
                          }}
                          className={`w-7 h-7 flex items-center justify-center text-sm rounded-xl transition-all hover:scale-125 ${
                            hasReacted
                              ? 'bg-violet-100 dark:bg-violet-900/60 ring-1 ring-violet-500 scale-110'
                              : 'hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setActiveReactionPickerMessageId(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs transition-all ${
                    isDeleted
                      ? 'bg-slate-100 dark:bg-[#10111d] border border-slate-200 dark:border-white/[0.08] text-slate-400 italic'
                      : mine
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-br-xs shadow-md shadow-violet-600/15'
                      : 'bg-white dark:bg-[#10111d] text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-white/[0.08]'
                  }`}
                >
                  {/* Sender Name for group chats */}
                  {!mine && isGroup && (m.sender_user_name || m.senderUserName) && (
                    <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 mb-1">
                      {m.sender_user_name || m.senderUserName}
                    </p>
                  )}

                  {/* Body */}
                  {isDeleted ? (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isRtl ? 'این پیام حذف شده است' : 'This message was deleted'}
                        {m.deletion_reason && ` (${m.deletion_reason})`}
                      </span>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}

                  {/* Attachments */}
                  {!isDeleted && (m.attachments || []).length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {(m.attachments || []).map((ref, i) => {
                        const att = resolveAtt(ref);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => att && setPreviewAtt(att)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-[10px] transition-all text-end ${
                              mine
                                ? 'bg-white/15 border-white/25 text-white hover:bg-white/20'
                                : 'bg-slate-50 dark:bg-[#0c0d15] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate flex-1 font-medium">
                              {ref.attachment_name || ref.attachmentName || (att?.fileName || 'Document')}
                            </span>
                            <span className="text-[9px] opacity-70 font-mono">
                              {(ref.attachment_file_size ? (ref.attachment_file_size / 1024).toFixed(0) + ' KB' : '')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer (timestamp, edited, delivered & read checkmarks) */}
                  <div className={`flex items-center gap-1.5 mt-1.5 text-[9px] ${mine ? 'text-violet-200' : 'text-slate-400'}`}>
                    <span>{formatPersianDate(m.created_at || m.createdAt, true).split(' - ').pop()}</span>
                    {isEdited && !isDeleted && (
                      <span className="font-medium">({isRtl ? 'ویرایش‌شده' : 'edited'})</span>
                    )}

                    {/* Outgoing Message Status Checkmark Indicator */}
                    {mine && !isDeleted && (() => {
                      const statusVal = String(m.status || '').toUpperCase();
                      const isSending = statusVal === 'SENDING' || statusVal === MessageStatus.SENDING;

                      const readList = Array.from(new Set([
                        ...(m.readBy || []),
                        ...(m.read_by || []),
                        ...(m.read_by_user_ids || []),
                        ...(m.readByUserIds || []),
                      ])).filter((uid) => uid && uid !== currentUserId);

                      const deliveredList = Array.from(new Set([
                        ...readList,
                        ...(m.delivered_by_user_ids || []),
                        ...(m.deliveredByUserIds || []),
                      ])).filter((uid) => uid && uid !== currentUserId);

                      const isRead = readList.length > 0 || statusVal === 'READ' || statusVal === MessageStatus.READ || !!(m.read_at || m.readAt);
                      const isDelivered = isRead || deliveredList.length > 0 || statusVal === 'DELIVERED' || statusVal === MessageStatus.DELIVERED || !!(m.delivered_at || m.deliveredAt);

                      const readerNames = readList
                        .map((uid) => (users || []).find((u) => u.id === uid)?.name || uid)
                        .filter(Boolean);

                      let statusTooltip = isRtl ? 'ارسال شده به سرور' : 'Sent to server';
                      let statusText = isRtl ? 'ارسال شد' : 'Sent';

                      if (isSending) {
                        statusTooltip = isRtl ? 'در حال ارسال به سرور...' : 'Sending to server...';
                        statusText = isRtl ? 'در حال ارسال' : 'Sending';
                      } else if (isRead) {
                        if (isGroup) {
                          statusTooltip = isRtl
                            ? `خوانده شده توسط: ${readerNames.length > 0 ? readerNames.join('، ') : `${readList.length} نفر`}`
                            : `Read by: ${readerNames.length > 0 ? readerNames.join(', ') : `${readList.length} members`}`;
                          statusText = isRtl ? `خوانده شد (${readList.length})` : `Read (${readList.length})`;
                        } else {
                          statusTooltip = isRtl ? 'توسط مخاطب خوانده شد' : 'Read by recipient';
                          statusText = isRtl ? 'خوانده شد' : 'Read';
                        }
                      } else if (isDelivered) {
                        if (isGroup) {
                          statusTooltip = isRtl
                            ? `تحویل داده شده به اعضای گروه (${deliveredList.length} نفر)`
                            : `Delivered to group members (${deliveredList.length})`;
                          statusText = isRtl ? 'تحویل شد' : 'Delivered';
                        } else {
                          statusTooltip = isRtl ? 'به دستگاه مخاطب تحویل شد' : 'Delivered to recipient';
                          statusText = isRtl ? 'تحویل شد' : 'Delivered';
                        }
                      }

                      return (
                        <span
                          className="inline-flex items-center gap-1 font-medium transition-all select-none"
                          title={statusTooltip}
                        >
                          {isSending ? (
                            <>
                              <Clock className="w-3 h-3 text-violet-300 animate-pulse shrink-0" />
                              <span className="text-[9px] text-violet-200/70">{statusText}</span>
                            </>
                          ) : isRead ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-300 dark:text-cyan-400 shrink-0 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                              <span className="text-[9px] text-cyan-200 dark:text-cyan-300 font-bold drop-shadow-xs">
                                {statusText}
                              </span>
                            </>
                          ) : isDelivered ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5 text-slate-200/90 dark:text-slate-300 shrink-0" />
                              <span className="text-[9px] text-violet-100/90 font-medium">
                                {statusText}
                              </span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 text-violet-200/80 shrink-0" />
                              <span className="text-[9px] opacity-75">
                                {statusText}
                              </span>
                            </>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Grouped Reactions Pills */}
                {!isDeleted && groupedReactions.length > 0 && (
                  <div className={`flex flex-wrap items-center gap-1 mt-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {groupedReactions.map((gr) => (
                      <button
                        key={gr.emoji}
                        type="button"
                        onClick={() => onToggleReaction && onToggleReaction(m.id, gr.emoji)}
                        title={`${gr.emoji} • ${gr.users.join('، ')}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border ${
                          gr.reactedByMe
                            ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-400 dark:border-violet-500/50 text-violet-700 dark:text-violet-300 font-bold shadow-xs scale-[1.02]'
                            : 'bg-white/90 dark:bg-[#10111d] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="text-xs">{gr.emoji}</span>
                        <span className="text-[10px] font-mono opacity-90">{gr.count}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === m.id ? null : m.id)}
                      title={isRtl ? 'افزودن واکنش' : 'Add reaction'}
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] border border-dashed border-slate-300 dark:border-white/20 text-slate-400 hover:text-violet-500 dark:hover:text-violet-300 hover:border-violet-500/40 transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}

                {/* Hover Action Menu */}
                {!isDeleted && (
                  <div className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 p-1 rounded-xl bg-white/95 dark:bg-[#10111d]/95 backdrop-blur-md shadow-lg border border-slate-200 dark:border-white/[0.1] z-20 ${
                    mine ? '-start-18' : '-end-18'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setActiveReactionPickerMessageId(activeReactionPickerMessageId === m.id ? null : m.id)}
                      title={isRtl ? 'واکنش به پیام' : 'React to message'}
                      className={`p-1 rounded-lg transition-colors ${
                        activeReactionPickerMessageId === m.id
                          ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300'
                          : 'text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <SmilePlus className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(m)}
                        title={isRtl ? 'ویرایش پیام' : 'Edit message'}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeletingMessageId(m.id)}
                        title={isRtl ? 'حذف پیام' : 'Delete message'}
                        className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Real-time Live Typing Indicator Bubble */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2.5 start-0 animate-in fade-in slide-in-from-bottom-2 duration-200 py-1">
            <div className="flex -space-x-1.5 rtl:space-x-reverse shrink-0">
              {typingUsers.slice(0, 3).map((u) => {
                const userObj = (users || []).find((x) => x.id === u.userId);
                return (
                  <div
                    key={u.userId}
                    title={u.userName}
                    className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-[#0c0d15] overflow-hidden bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-xs"
                  >
                    {userObj?.avatar ? (
                      <img src={userObj.avatar} alt={u.userName} className="w-full h-full object-cover" />
                    ) : (
                      u.userName.charAt(0)
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bubble with bouncing animated wave dots */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl rounded-bl-xs bg-white/90 dark:bg-[#131622] border border-slate-200 dark:border-violet-500/20 shadow-xs backdrop-blur-sm">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {renderTypingText()}
              </span>
              <div className="flex items-center gap-1 ms-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-bounce"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Editing State Banner */}
      {editingMessage && (
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isRtl ? 'در حال ویرایش پیام:' : 'Editing message:'}</span>
            <span className="truncate max-w-xs font-semibold">{editingMessage.body}</span>
          </div>
          <button
            type="button"
            onClick={() => setEditingMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pending Attachments preview */}
      {pendingAttachments.length > 0 && (
        <div className="p-2 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0c0d15] flex flex-wrap gap-2">
          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-[#10111d] border border-slate-200 dark:border-white/[0.08] text-xs shadow-xs"
            >
              <Paperclip className="w-3.5 h-3.5 text-violet-500" />
              <span className="truncate max-w-[150px]">{att.fileName}</span>
              <button
                type="button"
                onClick={() => setPendingAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                className="text-slate-400 hover:text-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] bg-white/90 dark:bg-[#10111d]">
        <div className="flex items-end gap-2">
          {/* Hidden device file input */}
          <input
            ref={deviceFileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,image/*,application/pdf"
            onChange={(e) => {
              handleDeviceFileUpload(e.target.files);
              if (deviceFileInputRef.current) deviceFileInputRef.current.value = '';
            }}
            className="hidden"
          />

          {/* Attach button & popover menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              title={isRtl ? 'پیوست فایل' : 'Attach file'}
              disabled={isDeviceUploading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors shrink-0 flex items-center justify-center"
            >
              {isDeviceUploading ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" /> : <Paperclip className="w-4 h-4" />}
            </button>

            {showAttachMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                <div className={`absolute bottom-12 ${isRtl ? 'right-0' : 'left-0'} w-52 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.1] shadow-xl p-1.5 z-50 animate-fadeIn`}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      setIsAttachModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors font-medium text-end"
                  >
                    <Paperclip className="w-4 h-4 text-violet-500 shrink-0" />
                    <span>{isRtl ? 'انتخاب از اسناد MMBA' : 'Select from MMBA Documents'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      deviceFileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors font-medium text-end"
                  >
                    <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{isRtl ? 'آپلود از حافظه دستگاه / گالری' : 'Upload from Device / Gallery'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Emoji picker button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title={isRtl ? 'ایموجی' : 'Emoji'}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors shrink-0 flex items-center justify-center"
            >
              <SmilePlus className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                <div className={`absolute bottom-12 ${isRtl ? 'left-10' : '-right-10'} w-60 rounded-2xl bg-white dark:bg-[#131622] border border-slate-200 dark:border-white/[0.1] shadow-xl p-2 z-50 animate-fadeIn grid grid-cols-5 gap-1`}>
                  {['👍', '❤️', '🔥', '👏', '😂', '😮', '😢', '🎉', '✅', '🙏', '💡', '📌', '📞', '💰', '📄', '⚙️', '🚀', '📊', '🛠️', '🤝'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                        composerRef.current?.focus();
                      }}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Input or Edit textarea */}
          {editingMessage ? (
            <div className="flex-1 flex items-center gap-2">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={1}
                className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0c0d15] border border-violet-500 text-slate-900 dark:text-slate-100 focus:outline-none resize-none max-h-32"
              />
              <Button variant="primary" size="sm" onClick={handleSaveEdit} leftIcon={<Check className="w-3.5 h-3.5" />}>
                {isRtl ? 'ذخیره' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingMessage(null)}>
                {isRtl ? 'انصراف' : 'Cancel'}
              </Button>
            </div>
          ) : (
            <textarea
              ref={composerRef}
              value={draft}
              onChange={handleDraftChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (conversation?.id) {
                  storage.setTyping(conversation.id, false);
                }
              }}
              rows={1}
              placeholder={isRtl ? 'پیام خود را بنویسید... (Enter ارسال)' : 'Type a message... (Enter to send)'}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0c0d15] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 resize-none max-h-32 leading-relaxed"
            />
          )}

          {!editingMessage && (
            <Button
              variant="primary"
              size="md"
              onClick={send}
              disabled={!draft.trim() && pendingAttachments.length === 0}
              leftIcon={<Send className="w-4 h-4" />}
            >
              {isRtl ? 'ارسال' : 'Send'}
            </Button>
          )}
        </div>
      </div>

      {/* Document Attachment Picker Modal */}
      <AttachDocumentModal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        attachments={attachments}
        onSelectAttachment={(att) => {
          setPendingAttachments((prev) => [...prev, att]);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteMessageModal
        isOpen={Boolean(deletingMessageId)}
        onClose={() => setDeletingMessageId(null)}
        onConfirm={(reason) => {
          if (deletingMessageId) {
            onDeleteMessage(deletingMessageId, reason);
            setDeletingMessageId(null);
          }
        }}
      />

      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAtt)}
        onClose={() => setPreviewAtt(null)}
        attachment={previewAtt}
      />
    </div>
  );
};
