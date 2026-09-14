import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Attachment, User } from '../../types';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate } from '../../lib/dateUtils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AttachmentPreviewModal } from '../ui/AttachmentPreviewModal';
import { Send, Paperclip } from 'lucide-react';

export interface ChatThreadProps {
  conversationTitle: string;
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (body: string, attachments?: { attachment_id: string; attachment_name: string; attachment_file_size?: number; attachment_file_type?: string }[]) => void;
  onMarkRead: () => void;
  attachments: Attachment[];
  users?: User[];
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  conversationTitle,
  messages = [],
  currentUserId,
  onSend,
  onMarkRead,
  attachments = [],
  users = [],
}) => {
  const { t, isRtl } = useTranslation();
  const [draft, setDraft] = useState('');
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationTitle]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft('');
    composerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const resolveAtt = (ref: { attachment_id?: string; attachmentId?: string; attachment_name?: string; attachmentName?: string }) => {
    const id = ref.attachment_id || ref.attachmentId || '';
    return attachments.find((a) => a.id === id);
  };

  const senderInfo = (m: ChatMessage): User | undefined => {
    const sid = m.sender_user_id || m.senderUserId || '';
    return users.find((u) => u.id === sid);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/60">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{conversationTitle}</h3>
          <p className="text-[10px] text-slate-400">{(messages || []).length} {isRtl ? 'پیام' : 'messages'}</p>
        </div>
        <Badge variant="indigo" size="sm">{isRtl ? 'متن' : 'Text'}</Badge>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 bg-slate-50 dark:bg-slate-950/40">
        {(messages || []).length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-slate-400">
            {isRtl ? 'هنوز پیامی رد و بدل نشده است.' : 'No messages yet.'}
          </div>
        )}
        {(messages || []).map((m) => {
          const mine = m.sender_user_id === currentUserId || m.senderUserId === currentUserId;
          const sender = senderInfo(m);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2 group`}>
              {!mine && (
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 ring-2 ring-white dark:ring-slate-800 shadow-sm">
                  {sender?.avatar ? (
                    <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center text-[10px] font-bold">
                      {(m.sender_user_name || '?').charAt(0)}
                    </div>
                  )}
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                  mine
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700/60'
                }`}
              >
                {!mine && (m.sender_user_name || m.senderUserName) && (
                  <p className={`text-[10px] font-bold mb-0.5 ${mine ? 'text-indigo-200' : 'text-indigo-500'}`}>
                    {m.sender_user_name || m.senderUserName}
                  </p>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {(m.attachments || []).length > 0 && (
                  <div className="mt-1.5 space-y-1.5">
                    {(m.attachments || []).map((ref, i) => {
                      const att = resolveAtt(ref);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => att && setPreviewAtt(att)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[10px] ${
                            mine
                              ? 'bg-white/15 border-white/25 text-white'
                              : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{ref.attachment_name || ref.attachmentName || (att?.fileName || '')}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className={`flex items-center gap-1.5 mt-1 text-[9px] ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {formatPersianDate(m.created_at || m.createdAt, true).split(' - ').pop()}
                  {mine && <span>{String(m.status) === 'READ' ? (isRtl ? 'خوانده' : 'Read') : (isRtl ? 'ارسال' : 'Sent')}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 3000))}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={isRtl ? 'پیام خود را بنویسید... (Enter ارسال)' : 'Type a message... (Enter to send)'}
            className="flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 resize-none max-h-32"
          />
          <Button variant="primary" size="md" onClick={send} disabled={!draft.trim()} leftIcon={<Send className="w-4 h-4" />}>
            {isRtl ? 'ارسال' : 'Send'}
          </Button>
        </div>
        <p className="text-[9px] text-slate-400 mt-1">{isRtl ? 'Shift+Enter برای خط جدید' : 'Shift+Enter for newline'}</p>
      </div>

      <AttachmentPreviewModal
        isOpen={Boolean(previewAtt)}
        onClose={() => setPreviewAtt(null)}
        attachment={previewAtt}
      />
    </div>
  );
};