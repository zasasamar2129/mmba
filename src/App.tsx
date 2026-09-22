import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { storage, subscribeToStorage } from './services/storage';
import { pushService } from './services/pushService';
import {
  Customer, Call, Task, Payment, CheckItem, Contract, SimCard, RepairTicket, Attachment, User, AuditLog, VoiceNote, Lead, DocumentShare, Consignment, ChatConversation
} from './types';
import { isAdmin, canViewTask } from './lib/permissions';
import { I18nProvider, useTranslation } from './lib/i18n';

// Modals - lazy loaded
const LoginModal = lazy(() => import('./components/auth/LoginModal').then(m => ({ default: m.LoginModal })));
const LockScreen = lazy(() => import('./components/auth/LockScreen').then(m => ({ default: m.LockScreen })));
const CustomerFormModal = lazy(() => import('./components/customers/CustomerFormModal').then(m => ({ default: m.CustomerFormModal })));
const CallFormModal = lazy(() => import('./components/calls/CallFormModal').then(m => ({ default: m.CallFormModal })));
const TaskFormModal = lazy(() => import('./components/tasks/TaskFormModal').then(m => ({ default: m.TaskFormModal })));
const PaymentFormModal = lazy(() => import('./components/finances/PaymentFormModal').then(m => ({ default: m.PaymentFormModal })));
const CheckFormModal = lazy(() => import('./components/finances/CheckFormModal').then(m => ({ default: m.CheckFormModal })));
const ContractFormModal = lazy(() => import('./components/contracts/ContractFormModal').then(m => ({ default: m.ContractFormModal })));
const SimFormModal = lazy(() => import('./components/sims/SimFormModal').then(m => ({ default: m.SimFormModal })));
const RepairFormModal = lazy(() => import('./components/repairs/RepairFormModal').then(m => ({ default: m.RepairFormModal })));
const VoiceNoteRecorderModal = lazy(() => import('./components/voice/VoiceNoteRecorderModal').then(m => ({ default: m.VoiceNoteRecorderModal })));
const TextNoteModal = lazy(() => import('./components/voice/TextNoteModal').then(m => ({ default: m.TextNoteModal })));
const UserProfileMenu = lazy(() => import('./components/layout/UserProfileMenu').then(m => ({ default: m.UserProfileMenu })));
const ReportIssueModal = lazy(() => import('./components/ui/ReportIssueModal').then(m => ({ default: m.ReportIssueModal })));

// Views - lazy loaded with preload for faster navigation
const DashboardOverview = lazy(() => import('./components/dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const CustomerList = lazy(() => import('./components/customers/CustomerList').then(m => ({ default: m.CustomerList })));
const CustomerDetailView = lazy(() => import('./components/customers/CustomerDetailView').then(m => ({ default: m.CustomerDetailView })));
const LeadList = lazy(() => import('./components/leads/LeadList').then(m => ({ default: m.LeadList })));
const VoiceNoteList = lazy(() => import('./components/voice/VoiceNoteList').then(m => ({ default: m.VoiceNoteList })));
const CallList = lazy(() => import('./components/calls/CallList').then(m => ({ default: m.CallList })));
const TaskList = lazy(() => import('./components/tasks/TaskList').then(m => ({ default: m.TaskList })));
const PaymentList = lazy(() => import('./components/finances/PaymentList').then(m => ({ default: m.PaymentList })));
const CheckList = lazy(() => import('./components/finances/CheckList').then(m => ({ default: m.CheckList })));
const ContractList = lazy(() => import('./components/contracts/ContractList').then(m => ({ default: m.ContractList })));
const SimList = lazy(() => import('./components/sims/SimList').then(m => ({ default: m.SimList })));
const RepairList = lazy(() => import('./components/repairs/RepairList').then(m => ({ default: m.RepairList })));
const AttachmentList = lazy(() => import('./components/attachments/AttachmentList').then(m => ({ default: m.AttachmentList })));
const AccountingDashboard = lazy(() => import('./components/finance/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })));
const ReportsDashboard = lazy(() => import('./components/reports/ReportsDashboard').then(m => ({ default: m.ReportsDashboard })));
const AdminUserMatrix = lazy(() => import('./components/admin/AdminUserMatrix').then(m => ({ default: m.AdminUserMatrix })));
const AuditLogViewer = lazy(() => import('./components/admin/AuditLogViewer').then(m => ({ default: m.AuditLogViewer })));
const SettingsBackup = lazy(() => import('./components/admin/SettingsBackup').then(m => ({ default: m.SettingsBackup })));
const DocumentInbox = lazy(() => import('./components/inbox/DocumentInbox').then(m => ({ default: m.DocumentInbox })));
const ConsignmentList = lazy(() => import('./components/consignment/ConsignmentList').then(m => ({ default: m.ConsignmentList })));
const ChatApp = lazy(() => import('./components/chat/ChatApp').then(m => ({ default: m.ChatApp })));

// Preload all views during idle time so navigation feels instant (~sub-1s)
if (typeof window !== 'undefined') {
  const preloadAll = () => {
    import('./components/dashboard/DashboardOverview');
    import('./components/customers/CustomerList');
    import('./components/customers/CustomerDetailView');
    import('./components/tasks/TaskList');
    import('./components/finances/PaymentList');
    import('./components/attachments/AttachmentList');
    import('./components/calls/CallList');
    import('./components/voice/VoiceNoteList');
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(preloadAll, { timeout: 1500 });
  } else {
    setTimeout(preloadAll, 800);
  }
}

const AppContent: React.FC = () => {
  const { isRtl, t } = useTranslation();
  const { success, error: toastError } = useToast();

  // App Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // App Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [sims, setSims] = useState<SimCard[]>([]);
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [documentShares, setDocumentShares] = useState<DocumentShare[]>([]);
  const [consignments, setConsignments] = useState<Consignment[]>([]);
  const [chatConversations, setChatConversations] = useState<(ChatConversation & { _unread?: number })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(storage.getCurrentUser());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(storage.isLoggedIn());
  const [isLocked, setIsLocked] = useState<boolean>(storage.isSessionLocked());
  const [lockedUser, setLockedUser] = useState<User | null>(storage.getLockedUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Modals Open State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callInitialCustomer, setCallInitialCustomer] = useState<Customer | null>(null);
  const [callInitialLead, setCallInitialLead] = useState<Lead | null>(null);
  const [callInitialMobile, setCallInitialMobile] = useState<string>('');

  const [isVoiceNoteModalOpen, setIsVoiceNoteModalOpen] = useState(false);
  const [voiceNoteInitialCustomer, setVoiceNoteInitialCustomer] = useState<Customer | null>(null);
  const [isTextNoteModalOpen, setIsTextNoteModalOpen] = useState(false);
  const [textNoteToEdit, setTextNoteToEdit] = useState<VoiceNote | null>(null);
  const [voiceNoteMode, setVoiceNoteMode] = useState<'RECORD' | 'UPLOAD'>('RECORD');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskInitialCustomer, setTaskInitialCustomer] = useState<Customer | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | null>(null);
  const [paymentInitialCustomer, setPaymentInitialCustomer] = useState<Customer | null>(null);

  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [checkToEdit, setCheckToEdit] = useState<CheckItem | null>(null);
  const [checkInitialCustomer, setCheckInitialCustomer] = useState<Customer | null>(null);

  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [contractInitialCustomer, setContractInitialCustomer] = useState<Customer | null>(null);

  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [simToEdit, setSimToEdit] = useState<SimCard | null>(null);

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [repairToEdit, setRepairToEdit] = useState<RepairTicket | null>(null);
  const [repairInitialCustomer, setRepairInitialCustomer] = useState<Customer | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReportIssueModalOpen, setIsReportIssueModalOpen] = useState(false);

  // Refresh all state from local / server storage
  const refreshData = () => {
    setCustomers(storage.getCustomers());
    setLeads(storage.getLeads());
    setCalls(storage.getCalls());
    // Notes are private per user: only show the current user's own notes,
    // plus admins/owners can see all for oversight.
    {
      const allNotes = storage.getVoiceNotes();
      const me = storage.getCurrentUser();
      const isPrivileged = me && (me.role === 'GOD' || me.role === 'OWNER' || me.role === 'SUPER_ADMIN');
      setVoiceNotes(isPrivileged ? allNotes : allNotes.filter((n) => n.createdById === me?.id));
    }
    setTasks(storage.getTasks());
    setPayments(storage.getPayments());
    setChecks(storage.getChecks());
    setContracts(storage.getContracts());
    setSims(storage.getSims());
    setRepairs(storage.getRepairs());
    setAttachments(storage.getAttachments());
    setDocumentShares(storage.getDocumentShares());
    setConsignments(storage.getConsignments());
    setChatConversations(storage.getConversationsForUser(storage.getCurrentUser().id).conversations);
    setUsers(storage.getUsers());
    setAuditLogs(storage.getAuditLogs());
    setCurrentUser(storage.getCurrentUser());
    setIsLoggedIn(storage.isLoggedIn());
    setIsLocked(storage.isSessionLocked());
    setLockedUser(storage.getLockedUser());
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = subscribeToStorage(() => {
      refreshData();
    });

    const handleAutoLockTrigger = () => {
      setIsLocked(true);
      setLockedUser(storage.getLockedUser());
    };

    // Step 9 §33: server-side session expiry (401 on a guarded endpoint).
    // Log out cleanly and open login, never a redirect loop.
    const handleSessionExpired = () => {
      storage.logout();
      setIsLoggedIn(false);
      setIsLocked(false);
      setLockedUser(null);
      setIsLoginModalOpen(true);
    };
    window.addEventListener('mmba-auto-lock', handleAutoLockTrigger);
    window.addEventListener('mmba-session-expired', handleSessionExpired);

    return () => {
      unsubscribe();
      window.removeEventListener('mmba-auto-lock', handleAutoLockTrigger);
      window.removeEventListener('mmba-session-expired', handleSessionExpired);
    };
  }, []);

  // Customer selection helper
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const selectedCustomerObj = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, customers]);

  // Quick Voice Note Modal opener
  const handleOpenVoiceNote = (mode: 'RECORD' | 'UPLOAD' = 'RECORD', cust: Customer | null = null) => {
    setVoiceNoteMode(mode);
    setVoiceNoteInitialCustomer(cust);
    setIsVoiceNoteModalOpen(true);
  };

  // Auth actions
  const handleUserChange = (user: User) => {
    storage.setCurrentUser(user);
    setCurrentUser(user);
    refreshData();
  };

  const handleLogout = () => {
    storage.logout();
    setIsLoggedIn(false);
    setIsLoginModalOpen(true);
  };

  const handleLockSession = () => {
    storage.lockSession();
    setIsLocked(true);
    setLockedUser(storage.getLockedUser());
  };

  const handleUnlockSuccess = () => {
    setIsLocked(false);
    refreshData();
  };

  const handleSwitchFromLock = () => {
    storage.logout();
    setIsLocked(false);
    setIsLoggedIn(false);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (user: User) => {
    setIsLoggedIn(true);
    setIsLoginModalOpen(false);
    setCurrentUser(user);
    refreshData();
    // Auto request push notification permission as a direct result of the
    // user's login interaction, per the push UX spec (not on page load).
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      // Only request if permission has not already been decided.
      if (Notification.permission === 'default') {
        setTimeout(() => {
          pushService.initServiceWorker().then(() => {
            pushService.subscribeUser(user.id, user.name).catch((err) => {
              console.warn('[App] Auto push subscribe skipped:', err);
            });
          });
        }, 1200);
      }
    }
  };

  return (
    <div className="h-screen max-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors overflow-hidden">
      {/* Universal Top Header */}
      <Header
        currentUser={currentUser}
        allUsers={users}
        onUserChange={handleUserChange}
        onLogout={handleLogout}
        onLockSession={handleLockSession}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenNewCustomer={() => {
          setCustomerToEdit(null);
          setIsCustomerModalOpen(true);
        }}
        onOpenNewCall={() => {
          setCallInitialCustomer(null);
          setIsCallModalOpen(true);
        }}
        onOpenNewVoiceNote={(mode) => {
          handleOpenVoiceNote(mode || 'RECORD');
        }}
        onOpenNewTask={() => {
          setTaskToEdit(null);
          setTaskInitialCustomer(null);
          setIsTaskModalOpen(true);
        }}
        onOpenNewPayment={() => {
          setPaymentToEdit(null);
          setPaymentInitialCustomer(null);
          setIsPaymentModalOpen(true);
        }}
        onNavigate={setActiveTab}
        onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        isMobileMenuOpen={isMobileNavOpen}
      />

      {/* Main Layout: Sidebar on Left in LTR (English) and Right in RTL (Persian) */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Navigation Sidebar (Desktop + Tablet Rail + Mobile Drawer) */}
        <Sidebar
          activeTab={activeTab}
          currentUser={currentUser}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab !== 'customers') {
              setSelectedCustomerId(null);
            }
          }}
          voiceNotesCount={(voiceNotes || []).length}
          tasksCount={(tasks || []).filter((t) => canViewTask(currentUser, t) && t.status !== 'COMPLETED').length}
          checksCount={(checks || []).filter((c) => c.status === 'IN_SAFE' || c.status === 'DEPOSITED').length}
          repairsCount={(repairs || []).filter((r) => r.status !== 'DELIVERED').length}
          inboxUnreadCount={(documentShares || []).filter(
            (s) => (s.status === 'SENT') && (s.recipientUserId === currentUser.id || s.recipient_user_id === currentUser.id)
          ).length}
          chatUnreadCount={(chatConversations || []).reduce((acc, c) => acc + (c._unread || 0), 0)}
          isMobileOpen={isMobileNavOpen}
          onCloseMobile={() => setIsMobileNavOpen(false)}
          onLockSession={() => handleLockSession()}
          onLogout={handleLogout}
          onOpenUserProfile={() => setIsProfileModalOpen(true)}
          onOpenReportIssue={() => setIsReportIssueModalOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab === 'customers' && selectedCustomerId ? `customer-detail-${selectedCustomerId}` : activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-full"
            >
              <Suspense fallback={
                <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
                  <span className="ml-2">در حال بارگذاری...</span>
                </div>
              }>
                {/* DASHBOARD VIEW */}
                {activeTab === 'chat' && (
                  <ChatApp
                    conversations={chatConversations}
                    currentUser={currentUser}
                    allUsers={users}
                    attachments={attachments}
                    onRefresh={refreshData}
                  />
                )}

                {activeTab === 'dashboard' && (
                  <DashboardOverview
                    customers={customers}
                    calls={calls}
                    voiceNotes={voiceNotes}
                    tasks={tasks}
                    payments={payments}
                    checks={checks}
                    contracts={contracts}
                    sims={sims}
                    repairs={repairs}
                    onNavigate={setActiveTab}
                    onSelectCustomer={handleSelectCustomer}
                    onQuickCall={() => {
                      setCallInitialCustomer(null);
                      setIsCallModalOpen(true);
                    }}
                    onQuickVoiceNote={() => {
                      handleOpenVoiceNote('RECORD');
                    }}
                    onQuickTask={() => {
                      setTaskToEdit(null);
                      setTaskInitialCustomer(null);
                      setIsTaskModalOpen(true);
                    }}
                    onQuickCustomer={() => {
                      setCustomerToEdit(null);
                      setIsCustomerModalOpen(true);
                    }}
                    onQuickPayment={() => {
                      setPaymentInitialCustomer(null);
                      setIsPaymentModalOpen(true);
                    }}
                  />
                )}

              {/* CUSTOMERS VIEW */}
              {activeTab === 'customers' && (
                <>
                  {selectedCustomerObj ? (
                    <CustomerDetailView
                      customer={selectedCustomerObj}
                      allCustomers={customers}
                      allUsers={users}
                      currentUser={currentUser}
                      onBack={() => setSelectedCustomerId(null)}
                      onEditCustomer={(cust) => {
                        setCustomerToEdit(cust);
                        setIsCustomerModalOpen(true);
                      }}
                      onDeleteCustomer={() => {
                        setSelectedCustomerId(null);
                        refreshData();
                      }}
                      onRefreshCustomer={refreshData}
                      onOpenNewCall={(cust) => {
                        setCallInitialCustomer(cust);
                        setCallInitialLead(null);
                        setCallInitialMobile('');
                        setIsCallModalOpen(true);
                      }}
                      onOpenNewVoiceNote={(cust) => {
                        setVoiceNoteInitialCustomer(cust);
                        setIsVoiceNoteModalOpen(true);
                      }}
                      onOpenNewTask={(cust) => {
                        setTaskToEdit(null);
                        setTaskInitialCustomer(cust);
                        setIsTaskModalOpen(true);
                      }}
                      onOpenNewPayment={(cust) => {
                        setPaymentInitialCustomer(cust);
                        setIsPaymentModalOpen(true);
                      }}
                      onOpenNewCheck={(cust) => {
                        setCheckToEdit(null);
                        setCheckInitialCustomer(cust);
                        setIsCheckModalOpen(true);
                      }}
                      onOpenNewContract={(cust) => {
                        setContractToEdit(null);
                        setContractInitialCustomer(cust);
                        setIsContractModalOpen(true);
                      }}
                      onOpenNewRepair={(cust) => {
                        setRepairToEdit(null);
                        setRepairInitialCustomer(cust);
                        setIsRepairModalOpen(true);
                      }}
                    />
                  ) : (
                    <CustomerList
                      customers={customers}
                      currentUser={currentUser}
                      onSelectCustomer={handleSelectCustomer}
                      onAddNewCustomer={() => {
                        setCustomerToEdit(null);
                        setIsCustomerModalOpen(true);
                      }}
                      onEditCustomer={(cust) => {
                        setCustomerToEdit(cust);
                        setIsCustomerModalOpen(true);
                      }}
                      onRefreshCustomers={refreshData}
                      onQuickCall={(cust) => {
                        setCallInitialCustomer(cust);
                        setCallInitialLead(null);
                        setCallInitialMobile('');
                        setIsCallModalOpen(true);
                      }}
                      onQuickTask={(cust) => {
                        setTaskToEdit(null);
                        setTaskInitialCustomer(cust);
                        setIsTaskModalOpen(true);
                      }}
                    />
                  )}
                </>
              )}

              {/* LEADS & ANONYMOUS PROSPECTS VIEW */}
              {activeTab === 'leads' && (
                <LeadList
                  currentUser={currentUser}
                  onRecordCallForLead={(lead) => {
                    setCallInitialCustomer(null);
                    setCallInitialLead(lead);
                    setCallInitialMobile(lead.mobile);
                    setIsCallModalOpen(true);
                  }}
                  onOpenCustomerDetail={(customerId) => {
                    setSelectedCustomerId(customerId);
                    setActiveTab('customers');
                  }}
                />
              )}

              {/* VOICE NOTES (AUDIO MEMOS & RECORDINGS) VIEW */}
              {activeTab === 'voicenotes' && (
                <VoiceNoteList
                  voiceNotes={voiceNotes}
                  customers={customers}
                  currentUser={currentUser}
                  onOpenNewVoiceNote={handleOpenVoiceNote}
                  onOpenNewTextNote={() => { setTextNoteToEdit(null); setIsTextNoteModalOpen(true); }}
                  onEditNote={(note) => { setTextNoteToEdit(note); setIsTextNoteModalOpen(true); }}
                  onSelectCustomer={handleSelectCustomer}
                  onDeleteVoiceNote={(id) => {
                    storage.deleteVoiceNote(id);
                    success(t('common.success'));
                    refreshData();
                  }}
                />
              )}

              {/* CALLS (AI CALL TRANSCRIPTS) VIEW */}
              {activeTab === 'calls' && (
                <CallList
                  calls={calls}
                  customers={customers}
                  currentUser={currentUser}
                  onSelectCustomer={handleSelectCustomer}
                  onAddNewCall={() => {
                    setCallInitialCustomer(null);
                    setIsCallModalOpen(true);
                  }}
                  onRefreshCalls={refreshData}
                />
              )}

              {/* TASKS VIEW */}
              {activeTab === 'tasks' && (
                <TaskList
                  tasks={tasks}
                  customers={customers}
                  currentUser={currentUser}
                  onAddNewTask={() => {
                    setTaskToEdit(null);
                    setTaskInitialCustomer(null);
                    setIsTaskModalOpen(true);
                  }}
                  onEditTask={(tsk) => {
                    setTaskToEdit(tsk);
                    setIsTaskModalOpen(true);
                  }}
                  onRefreshTasks={refreshData}
                />
              )}

              {/* FINANCES (PAYMENTS) VIEW */}
              {activeTab === 'finances' && (
                <PaymentList
                  payments={payments}
                  customers={customers}
                  currentUser={currentUser}
                  onAddNewPayment={() => {
                    setPaymentToEdit(null);
                    setPaymentInitialCustomer(null);
                    setIsPaymentModalOpen(true);
                  }}
                  onEditPayment={(payment) => {
                    setPaymentToEdit(payment);
                    setPaymentInitialCustomer(null);
                    setIsPaymentModalOpen(true);
                  }}
                  onSelectCustomer={handleSelectCustomer}
                  onRefreshPayments={refreshData}
                />
              )}

              {/* CHECKS & TREASURY VIEW */}
              {activeTab === 'checks' && (
                <CheckList
                  checks={checks}
                  customers={customers}
                  currentUser={currentUser}
                  onAddNewCheck={() => {
                    setCheckToEdit(null);
                    setCheckInitialCustomer(null);
                    setIsCheckModalOpen(true);
                  }}
                  onEditCheck={(chk) => {
                    setCheckToEdit(chk);
                    setIsCheckModalOpen(true);
                  }}
                  onRefreshChecks={refreshData}
                />
              )}

              {/* CONTRACTS VIEW */}
              {activeTab === 'contracts' && (
                <ContractList
                  contracts={contracts}
                  customers={customers}
                  currentUser={currentUser}
                  onAddNewContract={() => {
                    setContractToEdit(null);
                    setContractInitialCustomer(null);
                    setIsContractModalOpen(true);
                  }}
                  onEditContract={(cnt) => {
                    setContractToEdit(cnt);
                    setIsContractModalOpen(true);
                  }}
                  onRefreshContracts={refreshData}
                />
              )}

              {/* DOUBLE-ENTRY ACCOUNTING & GENERAL LEDGER VIEW */}
              {activeTab === 'accounting' && (
                <AccountingDashboard
                  currentUser={currentUser}
                />
              )}

              {/* SIM CARDS WAREHOUSE VIEW */}
              {activeTab === 'sims' && (
                <SimList
                  sims={sims}
                  customers={customers}
                  contracts={contracts}
                  currentUser={currentUser}
                  allUsers={users}
                  onAddNewSim={() => {
                    setSimToEdit(null);
                    setIsSimModalOpen(true);
                  }}
                  onEditSim={(s) => {
                    setSimToEdit(s);
                    setIsSimModalOpen(true);
                  }}
                  onRefreshSims={refreshData}
                  onSelectCustomer={handleSelectCustomer}
                />
              )}

              {/* CONSIGNMENT VIEW */}
              {activeTab === 'consignment' && (
                <ConsignmentList
                  consignments={consignments}
                  customers={customers}
                  currentUser={currentUser}
                  allUsers={users}
                  sims={sims}
                  onRefresh={refreshData}
                />
              )}

              {/* REPAIR TICKETS & SERVICES VIEW */}
              {(activeTab === 'repairs' || activeTab === 'services') && (
                <RepairList
                  repairs={repairs}
                  customers={customers}
                  allUsers={users}
                  currentUser={currentUser}
                  onAddNewRepair={() => {
                    setRepairToEdit(null);
                    setRepairInitialCustomer(null);
                    setIsRepairModalOpen(true);
                  }}
                  onEditRepair={(rep) => {
                    setRepairToEdit(rep);
                    setIsRepairModalOpen(true);
                  }}
                  onRefreshRepairs={refreshData}
                />
              )}

              {/* ATTACHMENTS VIEW */}
              {activeTab === 'attachments' && (
                <AttachmentList
                  attachments={attachments}
                  customers={customers}
                  currentUser={currentUser}
                  onRefresh={refreshData}
                />
              )}

              {/* INBOX VIEW */}
              {activeTab === 'inbox' && (
                <DocumentInbox
                  inboxItems={documentShares}
                  currentUser={currentUser}
                  attachments={attachments}
                  onRefresh={refreshData}
                />
              )}

              {/* BI REPORTS VIEW */}
              {activeTab === 'reports' && (
                <ReportsDashboard
                  customers={customers}
                  calls={calls}
                  tasks={tasks}
                  payments={payments}
                  checks={checks}
                  contracts={contracts}
                  sims={sims}
                  repairs={repairs}
                />
              )}

              {/* USERS & ACCESS MATRIX (ADMIN ONLY) */}
              {activeTab === 'users' && isAdmin(currentUser) && (
                <AdminUserMatrix
                  users={users}
                  currentUser={currentUser}
                  onRefreshUsers={refreshData}
                />
              )}

              {/* AUDIT LOGS (ADMIN ONLY) */}
              {activeTab === 'audit' && isAdmin(currentUser) && (
                <AuditLogViewer
                  auditLogs={auditLogs}
                  allUsers={users}
                />
              )}

              {/* SETTINGS (ADMIN ONLY) */}
              {activeTab === 'settings' && isAdmin(currentUser) && (
                <SettingsBackup
                  initialTab="general"
                  onFullReset={refreshData}
                  currentUser={currentUser}
                />
              )}

              {/* BACKUPS (ADMIN ONLY) */}
              {activeTab === 'backups' && isAdmin(currentUser) && (
                <SettingsBackup
                  initialTab="backups"
                  onFullReset={refreshData}
                  currentUser={currentUser}
                />
              )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Action Modals - wrapped in Suspense for lazy loading */}
      <Suspense fallback={null}>
        <CustomerFormModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        customerToEdit={customerToEdit}
        onSelectCustomer={handleSelectCustomer}
        onSaved={() => {
          refreshData();
        }}
      />

      <CallFormModal
        isOpen={isCallModalOpen}
        onClose={() => {
          setIsCallModalOpen(false);
          setCallInitialCustomer(null);
          setCallInitialLead(null);
          setCallInitialMobile('');
        }}
        initialCustomer={callInitialCustomer}
        initialLead={callInitialLead}
        initialMobile={callInitialMobile}
        allCustomers={customers}
        allUsers={users}
        onOpenCustomerDetail={(customerId) => {
          setSelectedCustomerId(customerId);
          setActiveTab('customers');
        }}
        onSaved={() => {
          refreshData();
        }}
      />

      <VoiceNoteRecorderModal
        isOpen={isVoiceNoteModalOpen}
        onClose={() => setIsVoiceNoteModalOpen(false)}
        initialCustomer={voiceNoteInitialCustomer}
        allCustomers={customers}
        initialMode={voiceNoteMode}
        onSaved={() => {
          refreshData();
        }}
      />

      <TextNoteModal
        isOpen={isTextNoteModalOpen}
        onClose={() => setIsTextNoteModalOpen(false)}
        initialCustomer={voiceNoteInitialCustomer}
        allCustomers={customers}
        note={textNoteToEdit}
        onSaved={() => {
          refreshData();
        }}
      />

      <TaskFormModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        initialCustomer={taskInitialCustomer}
        allCustomers={customers}
        allUsers={users}
        onSaved={() => {
          refreshData();
        }}
      />

      <PaymentFormModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentToEdit(null);
        }}
        initialCustomer={paymentInitialCustomer}
        initialPayment={paymentToEdit}
        allCustomers={customers}
        onSaved={() => {
          refreshData();
        }}
      />

      <CheckFormModal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        checkToEdit={checkToEdit}
        initialCustomer={checkInitialCustomer}
        allCustomers={customers}
        onSaved={() => {
          refreshData();
        }}
      />

      <ContractFormModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        contractToEdit={contractToEdit}
        initialCustomer={contractInitialCustomer}
        allCustomers={customers}
        onSaved={() => {
          refreshData();
        }}
      />

      <SimFormModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        simToEdit={simToEdit}
        allCustomers={customers}
        onSaved={() => {
          refreshData();
        }}
      />

      <RepairFormModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        ticketToEdit={repairToEdit}
        initialCustomer={repairInitialCustomer}
        allCustomers={customers}
        allUsers={users}
        onSaved={() => {
          refreshData();
        }}
      />

      {/* User Profile & Edit Profile Modal */}
      <UserProfileMenu
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        allUsers={users}
        onUserChanged={(updatedUser) => {
          handleUserChange(updatedUser);
          refreshData();
        }}
        onLogout={() => {
          setIsProfileModalOpen(false);
          handleLogout();
        }}
        onLockSession={() => {
          setIsProfileModalOpen(false);
          handleLockSession();
        }}
      />

      {/* Report Issue & Feedback Modal */}
      <ReportIssueModal
        isOpen={isReportIssueModalOpen}
        onClose={() => setIsReportIssueModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Lock Screen Overlay */}
      <LockScreen
        isLocked={isLocked}
        lockedUser={lockedUser}
        onUnlockSuccess={handleUnlockSuccess}
        onSwitchUser={handleSwitchFromLock}
      />

      {/* Login & Switch User Modal */}
      <LoginModal
        isOpen={isLoginModalOpen || !isLoggedIn}
        availableUsers={users}
        onLoginSuccess={handleLoginSuccess}
        onClose={isLoggedIn ? () => setIsLoginModalOpen(false) : undefined}
      />
      </Suspense>
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </I18nProvider>
  );
}
