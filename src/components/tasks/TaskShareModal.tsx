import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Task, User } from '../../types';
import { Button } from '../ui/Button';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { Share2, Users, Check, ShieldAlert, ArrowRightLeft, UserCheck } from 'lucide-react';
import { isAdmin } from '../../lib/permissions';

export interface TaskShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  currentUser: User;
  allUsers: User[];
  onTaskUpdated: (updatedTask: Task) => void;
}

export const TaskShareModal: React.FC<TaskShareModalProps> = ({
  isOpen,
  onClose,
  task,
  currentUser,
  allUsers,
  onTaskUpdated,
}) => {
  const { success, error } = useToast();

  const [selectedSharedUserIds, setSelectedSharedUserIds] = useState<string[]>([]);
  const [reassignUserId, setReassignUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'share' | 'reassign'>('share');

  // Initialize selected shared users when modal opens
  React.useEffect(() => {
    if (task) {
      setSelectedSharedUserIds(task.sharedWithUserIds || []);
      setReassignUserId(task.assignedUserId || '');
    }
  }, [task, isOpen]);

  if (!task) return null;

  const isUserAdmin = isAdmin(currentUser);
  const isAssignedUser = task.assignedUserId === currentUser.id;
  const isCreator = task.creatorUserId === currentUser.id;

  // Toggle user in shared list
  const handleToggleSharedUser = (userId: string) => {
    setSelectedSharedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Save shared users
  const handleSaveShare = () => {
    if (!task) return;

    const sharedNames = selectedSharedUserIds
      .map((id) => allUsers.find((u) => u.id === id)?.name)
      .filter((n): n is string => Boolean(n));

    const updatedTask: Task = {
      ...task,
      sharedWithUserIds: selectedSharedUserIds,
      sharedWithUserNames: sharedNames,
      updatedAt: new Date().toISOString(),
    };

    const saved = storage.saveTask(updatedTask);
    success('دسترسی‌های اشتراک‌گذاری وظیفه با موفقیت به‌روزرسانی شد');
    onTaskUpdated(saved);
    onClose();
  };

  // Reassign / Delegate task to another user
  const handleReassign = () => {
    if (!task) return;
    if (!reassignUserId) {
      error('لطفاً کاربر جدید را جهت واگذاری انتخاب کنید');
      return;
    }

    const targetUser = allUsers.find((u) => u.id === reassignUserId);
    if (!targetUser) return;

    // When reassigning, optionally keep previous assigned user in shared list if they want
    const updatedShared = selectedSharedUserIds.filter((id) => id !== reassignUserId);

    const updatedTask: Task = {
      ...task,
      assignedUserId: targetUser.id,
      assignedUserName: targetUser.name,
      sharedWithUserIds: updatedShared,
      sharedWithUserNames: updatedShared
        .map((id) => allUsers.find((u) => u.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
      updatedAt: new Date().toISOString(),
    };

    const saved = storage.saveTask(updatedTask);
    success(`وظیفه با موفقیت به «${targetUser.name}» واگذار شد`);
    onTaskUpdated(saved);
    onClose();
  };

  // Filter out creator and current assignee for clean list
  const shareableUsers = allUsers.filter((u) => u.id !== task.assignedUserId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-indigo-400" />
          <span>اشتراک‌گذاری و واگذاری وظیفه</span>
        </div>
      }
      subtitle={`وظیفه: «${task.title}»`}
    >
      <div className="space-y-4">
        {/* Info Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">ایجادکننده (ادمین):</span>
            <span className="font-semibold text-slate-200">{task.creatorUserName || 'مدیر سیستم'}</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">مسئول اصلی انجام:</span>
            <span className="font-bold text-indigo-300">{task.assignedUserName}</span>
          </div>
          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800 leading-relaxed">
            🔒 <strong>قانون محرمانگی وظایف:</strong> این وظیفه فقط برای ایجادکننده (ادمین)، مسئول اصلی و کاربرانی که وظیفه با آنها به اشتراک گذاشته شده، قابل مشاهده و دسترسی است.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950/60 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('share')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'share'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>اشتراک‌گذاری همزمان (دسترسی مشاهده/همکاری)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reassign')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'reassign'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>واگذاری کامل به کاربر دیگر</span>
          </button>
        </div>

        {/* Tab 1: Share with other users */}
        {activeTab === 'share' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                انتخاب همکاران جهت دسترسی و مشاهده وظیفه:
              </span>
              <span className="text-[11px] text-indigo-400 font-medium">
                {selectedSharedUserIds.length} کاربر انتخاب شده
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 p-1">
              {shareableUsers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">کاربر دیگری برای اشتراک‌گذاری موجود نیست.</p>
              ) : (
                shareableUsers.map((u) => {
                  const isChecked = selectedSharedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-500/50 text-indigo-900 dark:text-slate-100 shadow-xs'
                          : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSharedUser(u.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{u.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{u.role} {u.department ? `• ${u.department}` : ''}</div>
                        </div>
                      </div>

                      {isChecked && (
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                          مشاهده و انجام
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={onClose}>
                انصراف
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveShare} leftIcon={<Check className="w-4 h-4" />}>
                ذخیره اشتراک‌گذاری
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Reassign task to another user */}
        {activeTab === 'reassign' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              با واگذاری کامل، مسئولیت اصلی این وظیفه به کاربر انتخابی منتقل می‌شود و در کارتابل ایشان قرار می‌گیرد:
            </p>

            <div className="space-y-1.5 max-h-60 overflow-y-auto p-1">
              {allUsers.map((u) => {
                const isCurrent = u.id === task.assignedUserId;
                const isSelected = u.id === reassignUserId;
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-500/60 text-amber-900 dark:text-slate-100'
                        : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="reassignUser"
                        value={u.id}
                        checked={isSelected}
                        onChange={() => setReassignUserId(u.id)}
                        className="w-4 h-4 text-amber-600 border-slate-300 dark:border-slate-700 focus:ring-amber-500 focus:ring-offset-white dark:focus:ring-offset-slate-900"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                              (مسئول فعلی)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{u.role} {u.department ? `• ${u.department}` : ''}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <UserCheck className="w-4 h-4 text-amber-400" />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={onClose}>
                انصراف
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleReassign}
                disabled={reassignUserId === task.assignedUserId}
                leftIcon={<ArrowRightLeft className="w-4 h-4" />}
                className="bg-amber-600 hover:bg-amber-500"
              >
                تایید واگذاری وظیفه
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
