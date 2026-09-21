import React, { useState, useMemo } from 'react';
import { Task, TaskPriority, TaskStatus, Customer, User } from '../../types';
import {
  CheckSquare, Search, Plus, Calendar, Clock,
  User as UserIcon, CheckCircle2, AlertCircle, Edit3, Trash2,
  Share2, Users, Lock, ShieldCheck, Mic, Volume2, Eye
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import { AudioPlayer } from '../ui/AudioPlayer';
import { ExportExcelButton } from '../ui/ExportExcelButton';
import { RTLNumber } from '../ui/RTLNumber';
import { exportTasksToExcel } from '../../lib/exportToExcel';
import { storage } from '../../services/storage';
import { useToast } from '../ui/Toast';
import { useTranslation } from '../../lib/i18n';
import { formatPersianDate, getRelativeTimeFa, isOverdue } from '../../lib/dateUtils';
import { canViewTask, canExecuteTask, canShareTask, isAdmin } from '../../lib/permissions';
import { TaskShareModal } from './TaskShareModal';
import { ListViewControls, usePersistentViewMode } from '../ui/ListViewControls';

export interface TaskListProps {
  tasks: Task[];
  customers: Customer[];
  users: User[];
  onAddNewTask: () => void;
  onEditTask: (task: Task) => void;
  onRefreshTasks: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks = [],
  customers = [],
  users = [],
  onAddNewTask,
  onEditTask,
  onRefreshTasks,
  onSelectCustomer,
}) => {
  const { success, error } = useToast();
  const { t, isRtl, formatNumber } = useTranslation();
  const currentUser = storage.getCurrentUser();
  const isCurrentUserAdmin = isAdmin(currentUser);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE'); // ACTIVE, ALL, COMPLETED, HAS_VOICE
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [viewFilter, setViewFilter] = useState<'ALL_ALLOWED' | 'MINE' | 'SHARED' | 'CREATED'>('ALL_ALLOWED');
  const [sharingTask, setSharingTask] = useState<Task | null>(null);

  // View Mode & Pagination
  const [viewMode, setViewMode] = usePersistentViewMode('tasks', 'list');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter tasks based on strict access control rules
  const visibleTasks = useMemo(() => {
    return (tasks || []).filter((t) => canViewTask(currentUser, t));
  }, [tasks, currentUser]);

  const filteredTasks = useMemo(() => {
    return visibleTasks
      .filter((t) => {
        // Tab / View scope filter
        if (viewFilter === 'MINE' && t.assignedUserId !== currentUser.id) return false;
        if (viewFilter === 'SHARED' && (!t.sharedWithUserIds || !t.sharedWithUserIds.includes(currentUser.id))) return false;
        if (viewFilter === 'CREATED' && t.creatorUserId !== currentUser.id) return false;

        // Status & Priority filters
        if (statusFilter === 'ACTIVE' && (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.CANCELLED)) return false;
        if (statusFilter === 'COMPLETED' && t.status !== TaskStatus.COMPLETED) return false;
        if (statusFilter === 'HAS_VOICE' && !t.voiceNoteAudioUrl) return false;
        if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

        // Search
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.customerName && t.customerName.toLowerCase().includes(q)) ||
          (t.assignedUserName && t.assignedUserName.toLowerCase().includes(q)) ||
          (t.creatorUserName && t.creatorUserName.toLowerCase().includes(q)) ||
          (t.voiceNoteTranscript && t.voiceNoteTranscript.toLowerCase().includes(q)) ||
          (t.sharedWithUserNames && t.sharedWithUserNames.some((n) => n.toLowerCase().includes(q)))
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [visibleTasks, viewFilter, searchQuery, statusFilter, priorityFilter, currentUser]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const handleToggleStatus = (task: Task) => {
    if (!canExecuteTask(currentUser, task)) {
      error(isRtl ? 'شما دسترسی لازم برای تغییر وضعیت این وظیفه را ندارید. این کار مختص مسئول یا ادمین است.' : 'You do not have permission to change this task status. Only the assignee or admin can.');
      return;
    }

    const isNowCompleted = task.status !== TaskStatus.COMPLETED;
    const updated: Task = {
      ...task,
      status: isNowCompleted ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
      completedAt: isNowCompleted ? new Date().toISOString() : undefined,
    };
    storage.saveTask(updated);
    success(isNowCompleted ? (isRtl ? 'وظیفه به عنوان تکمیل شده علامت خورد' : 'Task marked as completed') : (isRtl ? 'وظیفه مجدداً فعال شد' : 'Task reactivated'));
    onRefreshTasks();
  };

  const handleDelete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCurrentUserAdmin && task.creatorUserId !== currentUser.id) {
      error(isRtl ? 'فقط ایجادکننده یا ادمین سیستم می‌تواند وظیفه را حذف کند' : 'Only the creator or system admin can delete this task');
      return;
    }

    if (window.confirm(isRtl ? 'آیا از حذف این وظیفه اطمینان دارید؟' : 'Are you sure you want to delete this task?')) {
      storage.deleteTask(task.id);
      success(isRtl ? 'وظیفه حذف شد' : 'Task deleted');
      onRefreshTasks();
    }
  };

  const handleOpenShare = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canShareTask(currentUser, task)) {
      error(isRtl ? 'فقط مسئول انجام، ایجادکننده یا ادمین مجاز به اشتراک‌گذاری یا واگذاری این وظیفه هستند' : 'Only the assignee, creator, or admin can share or delegate this task');
      return;
    }
    setSharingTask(task);
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT:
        return <Badge variant="danger" size="sm">{t('tasks.priorityUrgent')}</Badge>;
      case TaskPriority.HIGH:
        return <Badge variant="warning" size="sm">{t('tasks.priorityHigh')}</Badge>;
      case TaskPriority.MEDIUM:
        return <Badge variant="info" size="sm">{t('tasks.priorityMedium')}</Badge>;
      case TaskPriority.LOW:
      default:
        return <Badge variant="default" size="sm">{t('tasks.priorityLow')}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>{t('tasks.title')}</span>
            </h1>
            <Badge variant="purple" size="sm">
              <RTLNumber value={filteredTasks.length} type="count" suffix={t('tasks.countSuffix')} />
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('tasks.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ExportExcelButton
            onExport={() => exportTasksToExcel(filteredTasks)}
            filename="tasks_list"
            size="sm"
          />

          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewTask}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            تعریف وظیفه جدید
          </Button>
        </div>
      </div>

      {/* Scope and Filter Tabs */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 liquid-glass-card border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        {/* User Scope Segment */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setViewFilter('ALL_ALLOWED');
              setCurrentPage(1);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewFilter === 'ALL_ALLOWED'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {isCurrentUserAdmin ? (isRtl ? 'همه وظایف مجاز (دید مدیریتی)' : 'All Permitted Tasks (Admin View)') : (isRtl ? 'کل کارتابل من' : 'My Taskboard')} ({visibleTasks.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setViewFilter('MINE');
              setCurrentPage(1);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewFilter === 'MINE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            وظایف مستقیم من ({visibleTasks.filter((t) => t.assignedUserId === currentUser.id).length})
          </button>

          <button
            type="button"
            onClick={() => {
              setViewFilter('SHARED');
              setCurrentPage(1);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewFilter === 'SHARED'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            به اشتراک‌گذاشته با من ({visibleTasks.filter((t) => t.sharedWithUserIds?.includes(currentUser.id)).length})
          </button>

          <button
            type="button"
            onClick={() => {
              setViewFilter('CREATED');
              setCurrentPage(1);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewFilter === 'CREATED'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            ایجاد شده توسط من ({visibleTasks.filter((t) => t.creatorUserId === currentUser.id).length})
          </button>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={isRtl ? 'جستجو در عنوان وظیفه، مشتری، توضیحات، پیام‌های صوتی یا مسئول...' : 'Search title, customer, description, voice notes, or assignee...'}
              rightIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
        </div>

        {/* Status and Priority */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{isRtl ? 'وضعیت:' : 'Status:'}</span>
            {[
              { key: 'ACTIVE', label: isRtl ? 'کارهای جاری و باز' : 'Active & Open' },
              { key: 'ALL', label: isRtl ? 'همه کارها' : 'All Tasks' },
              { key: 'COMPLETED', label: isRtl ? 'انجام شده‌ها' : 'Completed' },
              { key: 'HAS_VOICE', label: isRtl ? 'دارای وویس صوتی' : 'With Voice' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setStatusFilter(st.key);
                  setCurrentPage(1);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st.key
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{isRtl ? 'اولویت:' : 'Priority:'}</span>
            {['ALL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => {
                  setPriorityFilter(pr);
                  setCurrentPage(1);
                }}
                className={`text-xs px-2 py-0.5 rounded-md transition-all ${
                  priorityFilter === pr
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {pr === 'ALL' ? (isRtl ? 'همه' : 'All') : pr === 'URGENT' ? (isRtl ? 'فوری' : 'Urgent') : pr === 'HIGH' ? (isRtl ? 'بالا' : 'High') : pr === 'MEDIUM' ? (isRtl ? 'متوسط' : 'Medium') : (isRtl ? 'پایین' : 'Low')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Standard ListViewControls with View Toggle (Card vs Row/List) & Pagination */}
      <ListViewControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredTasks.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      {/* Main Content: Empty State, Table View, or Card View */}
      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center text-slate-500 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <CheckSquare className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-300">{isRtl ? 'هیچ وظیفه‌ای در این دسته‌بندی وجود ندارد' : 'No tasks in this category'}</h3>
          <p className="text-xs text-slate-500">{isRtl ? 'وظایف فقط برای مسئول مربوطه، ایجادکننده و افراد دارای اشتراک نمایش داده می‌شوند.' : 'Tasks are only visible to the assignee, creator, and shared users.'}</p>
          <Button variant="primary" size="sm" onClick={onAddNewTask}>
            {isRtl ? 'ایجاد اولین وظیفه' : 'Create First Task'}
          </Button>
        </div>
      ) : viewMode === 'list' ? (
        /* ROW / LIST VIEW (TABLE) */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-end text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-10 text-center">{isRtl ? 'وضعیت' : 'Status'}</th>
                <th className="p-3">{isRtl ? 'عنوان و شرح وظیفه' : 'Title & Description'}</th>
                <th className="p-3 w-28">{isRtl ? 'اولویت' : 'Priority'}</th>
                <th className="p-3 w-36">{isRtl ? 'مسئول انجام' : 'Assignee'}</th>
                <th className="p-3 w-32">{isRtl ? 'مشتری مرتبط' : 'Related Customer'}</th>
                <th className="p-3 w-36">{isRtl ? 'مهلت انجام (سررسید)' : 'Due Date'}</th>
                <th className="p-3 text-start w-36">{isRtl ? 'عملیات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedTasks.map((t) => {
                const overdue = isOverdue(t.dueDate) && t.status !== TaskStatus.COMPLETED;
                const isCompleted = t.status === TaskStatus.COMPLETED;
                const isAssignee = t.assignedUserId === currentUser.id;
                const isTaskCreator = t.creatorUserId === currentUser.id;
                const canEdit = isCurrentUserAdmin || isTaskCreator || isAssignee;
                const canShare = isCurrentUserAdmin || isTaskCreator || isAssignee;

                return (
                  <tr
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      isCompleted ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : overdue ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isCompleted}
                        onChange={() => handleToggleStatus(t)}
                        size="md"
                        colorScheme="emerald"
                        disabled={!canExecuteTask(currentUser, t)}
                      />
                    </td>

                    {/* Title and notes */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {t.title}
                        </span>
                        {t.voiceNoteAudioUrl && (
                          <span className="p-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400" title={isRtl ? 'دارای ویس صوتی' : 'Has voice attachment'}>
                            <Mic className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md mt-0.5">
                          {t.description}
                        </div>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="p-3 whitespace-nowrap">
                      {getPriorityBadge(t.priority)}
                    </td>

                    {/* Assigned User */}
                    <td className="p-3 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-1 font-medium">
                        <UserIcon className="w-3 h-3 text-slate-400" />
                        <span>{t.assignedUserName || (isRtl ? 'نامشخص' : 'Unassigned')}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="p-3 whitespace-nowrap">
                      {t.customerId && t.customerName ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCustomer(t.customerId!);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          {t.customerName}
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Due date */}
                    <td className="p-3 whitespace-nowrap">
                      <span className={`font-mono text-[11px] ${overdue ? 'text-rose-600 font-bold' : 'text-slate-600 dark:text-slate-400'}`} dir="ltr">
                        {formatPersianDate(t.dueDate, true)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-start whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canShare && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenShare(t, e)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={isRtl ? 'اشتراک‌گذاری و واگذاری' : 'Share & Delegate'}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditTask(t);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={isRtl ? 'ویرایش' : 'Edit'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(isCurrentUserAdmin || isTaskCreator) && (
                          <button
                            type="button"
                            onClick={(e) => handleDelete(t, e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={isRtl ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD VIEW */
        <div className="space-y-3">
          {paginatedTasks.map((t) => {
            const overdue = isOverdue(t.dueDate) && t.status !== TaskStatus.COMPLETED;
            const isCompleted = t.status === TaskStatus.COMPLETED;
            const isAssignee = t.assignedUserId === currentUser.id;
            const isShared = t.sharedWithUserIds && t.sharedWithUserIds.includes(currentUser.id);
            const isTaskCreator = t.creatorUserId === currentUser.id;
            const canEdit = isCurrentUserAdmin || isTaskCreator || isAssignee;
            const canShare = isCurrentUserAdmin || isTaskCreator || isAssignee;

            return (
              <div
                key={t.id}
                onClick={() => onEditTask(t)}
                className={`p-4 rounded-2xl liquid-glass-card border transition-all cursor-pointer text-end space-y-3 bg-white dark:bg-slate-900 ${
                  isCompleted
                    ? 'border-slate-200 dark:border-slate-800/60 opacity-60 bg-slate-100/50 dark:bg-slate-950/40'
                    : overdue
                    ? 'border-rose-500/40 bg-rose-50 dark:bg-rose-950/10 hover:border-rose-500/60'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(t);
                      }}
                      className="mt-0.5"
                      title={canExecuteTask(currentUser, t) ? (isRtl ? 'تغییر وضعیت انجام' : 'Toggle completion') : (isRtl ? 'عدم دسترسی تغییر وضعیت' : 'No permission to change status')}
                    >
                      <Checkbox
                        checked={isCompleted}
                        onChange={() => {}}
                        size="md"
                        colorScheme="emerald"
                        disabled={!canExecuteTask(currentUser, t)}
                      />
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isCompleted
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {t.title}
                        </span>
                        {getPriorityBadge(t.priority)}

                        {t.voiceNoteAudioUrl && (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium">
                            <Volume2 className="w-3 h-3" />
                            دارای صوت
                          </span>
                        )}

                        {isAssignee && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                            مسئول: من
                          </span>
                        )}

                        {isShared && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold flex items-center gap-1">
                            <Share2 className="w-2.5 h-2.5" />
                            اشتراک با من
                          </span>
                        )}
                      </div>

                      {t.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canShare && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenShare(t, e)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={isRtl ? 'واگذاری یا اشتراک‌گذاری وظیفه با دیگران' : 'Delegate or share task with others'}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTask(t);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={isRtl ? 'ویرایش وظیفه' : 'Edit task'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {(isCurrentUserAdmin || isTaskCreator) && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(t, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={isRtl ? 'حذف وظیفه' : 'Delete task'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {t.voiceNoteAudioUrl && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80" onClick={(e) => e.stopPropagation()}>
                    <AudioPlayer audioUrl={t.voiceNoteAudioUrl} />
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isRtl ? 'مسئول:' : 'Assignee:'} {t.assignedUserName || (isRtl ? 'تعیین‌نشده' : 'Not assigned')}</span>
                    </span>

                    {t.customerId && t.customerName && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCustomer(t.customerId!);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        مشتری: {t.customerName}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                      سررسید: {formatPersianDate(t.dueDate, true)} ({getRelativeTimeFa(t.dueDate)})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share / Delegate Modal */}
      {sharingTask && (
        <TaskShareModal
          isOpen={!!sharingTask}
          onClose={() => setSharingTask(null)}
          task={sharingTask}
          currentUser={currentUser}
          allUsers={users}
          onTaskUpdated={(updated) => {
            onRefreshTasks();
          }}
        />
      )}
    </div>
  );
};
