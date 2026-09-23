export enum UserRole {
  GOD = 'GOD',
  OWNER = 'OWNER',
  SUPERVISOR = 'SUPERVISOR',
  STORE_OPERATIONS = 'STORE_OPERATIONS',
  ACCOUNTING_ADMIN = 'ACCOUNTING_ADMIN',
  SALES = 'SALES',
  TECHNICAL = 'TECHNICAL',
  REPAIR_TECHNICIAN = 'REPAIR_TECHNICIAN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  SALES_AGENT = 'SALES_AGENT',
  TECHNICIAN = 'TECHNICIAN',
  READ_ONLY = 'READ_ONLY',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  PROSPECT = 'PROSPECT',
  VIP = 'VIP',
  INACTIVE = 'INACTIVE',
  BLACKLISTED = 'BLACKLISTED',
}

export enum CallType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  FOLLOW_UP = 'FOLLOW_UP',
  MEETING = 'MEETING',
  MISSED = 'MISSED',
  WHATSAPP = 'WHATSAPP',
  IN_PERSON = 'IN_PERSON',
}

export enum CallResult {
  ANSWERED = 'ANSWERED',
  UNANSWERED = 'UNANSWERED',
  NO_ANSWER = 'NO_ANSWER',
  BUSY = 'BUSY',
  PROMISE_PAYMENT = 'PROMISE_PAYMENT',
  FOLLOW_UP_REQUIRED = 'FOLLOW_UP_REQUIRED',
  RESOLVED = 'RESOLVED',
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  ORDER_PLACED = 'ORDER_PLACED',
  MEETING_SCHEDULED = 'MEETING_SCHEDULED',
  LEFT_VOICEMAIL = 'LEFT_VOICEMAIL',
  REJECTED = 'REJECTED',
}

export enum TaskStatus {
  TODO = 'TODO',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ContractType {
  SALES = 'SALES',
  SERVICE = 'SERVICE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  REPAIR = 'REPAIR',
  SIM_SALE = 'SIM_SALE',
  REPAIR_SERVICE = 'REPAIR_SERVICE',
  SUPPORT = 'SUPPORT',
  INSTALLMENT = 'INSTALLMENT',
  OTHER = 'OTHER',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  CANCELLED = 'CANCELLED',
  SIGNED = 'SIGNED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  REPORTED = 'REPORTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  APPROVED = 'APPROVED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD_READER = 'CARD_READER',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
  ONLINE_GATEWAY = 'ONLINE_GATEWAY',
  POS = 'POS',
  PAYA = 'PAYA',
}

export enum PaymentType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  DEPOSIT = 'DEPOSIT',
  INSTALLMENT = 'INSTALLMENT',
  ADVANCE = 'ADVANCE',
  SETTLEMENT = 'SETTLEMENT',
  BANK_TRANSFER = 'BANK_TRANSFER',
  POS = 'POS',
  CASH = 'CASH',
  ONLINE_GATEWAY = 'ONLINE_GATEWAY',
  OTHER = 'OTHER',
}

export enum CheckStatus {
  RECEIVED = 'RECEIVED',
  IN_SAFE = 'IN_SAFE',
  DEPOSITED = 'DEPOSITED',
  CLEARED = 'CLEARED',
  BOUNCED = 'BOUNCED',
  RETURNED = 'RETURNED',
  TRANSFERRED = 'TRANSFERRED',
  CANCELLED = 'CANCELLED',
}

export enum CheckType {
  RECEIVED = 'RECEIVED',
  ISSUED = 'ISSUED',
  GUARANTEE = 'GUARANTEE',
  PAID = 'PAID',
}

export enum SimStatus {
  AVAILABLE = 'AVAILABLE',
  IN_STOCK = 'IN_STOCK',
  ALLOCATED = 'ALLOCATED',
  SOLD = 'SOLD',
  RENTED = 'RENTED',
  ACTIVATED = 'ACTIVATED',
  RESERVED = 'RESERVED',
  SUSPENDED = 'SUSPENDED',
  DECOMMISSIONED = 'DECOMMISSIONED',
}

export enum SimType {
  PERMANENT = 'PERMANENT',
  CREDIT = 'CREDIT',
  DATA = 'DATA',
}

export enum SimOperator {
  MCI = 'MCI', // همراه اول
  IRANCELL = 'IRANCELL', // ایرانسل
  RIGHTEL = 'RIGHTEL', // رایتل
  SHATEL_MOBILE = 'SHATEL_MOBILE', // شاتل موبایل
  OTHER = 'OTHER',
}

export enum RepairStatus {
  RECEIVED = 'RECEIVED',
  DIAGNOSING = 'DIAGNOSING',
  WAITING_FOR_PARTS = 'WAITING_FOR_PARTS',
  WAITING_PARTS = 'WAITING_PARTS',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL',
  IN_PROGRESS = 'IN_PROGRESS',
  REPAIRED = 'REPAIRED',
  READY = 'READY',
  READY_DELIVERY = 'READY_DELIVERY',
  DELIVERED = 'DELIVERED',
  UNREPAIRABLE = 'UNREPAIRABLE',
  CANCELLED = 'CANCELLED',
}

export enum ModuleName {
  CUSTOMERS = 'CUSTOMERS',
  LEADS = 'LEADS',
  CALLS = 'CALLS',
  TASKS = 'TASKS',
  CONTRACTS = 'CONTRACTS',
  PAYMENTS = 'PAYMENTS',
  CHECKS = 'CHECKS',
  SIM_INVENTORY = 'SIM_INVENTORY',
  REPAIRS = 'REPAIRS',
  REPORTS = 'REPORTS',
  USERS = 'USERS',
  ROLES = 'ROLES',
  AUDIT_LOGS = 'AUDIT_LOGS',
  SETTINGS = 'SETTINGS',
  DOCUMENTS = 'DOCUMENTS',
  INBOX = 'INBOX',
  CONSIGNMENTS = 'CONSIGNMENTS',
  NOTES = 'NOTES',
  CHAT = 'CHAT',
  // New chat admin modules
  CHAT_ADMIN = 'CHAT_ADMIN',
  CHAT_GROUP = 'CHAT_GROUP',
  CHAT_BROADCAST = 'CHAT_BROADCAST',
}

export enum PermissionAction {
  VIEW = 'VIEW',
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  ARCHIVE = 'ARCHIVE',
  APPROVE = 'APPROVE',
  VERIFY = 'VERIFY',
  FINALIZE = 'FINALIZE',
  EXPORT = 'EXPORT',
  MANAGE = 'MANAGE',
}

export interface Permission {
  module: ModuleName;
  actions: PermissionAction[];
}

export interface Role {
  id: string;
  name: UserRole;
  titleFa: string;
  titleEn?: string;
  descriptionFa?: string;
  descriptionEn?: string;
  permissions: Permission[];
}

export interface User {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  username: string;
  password?: string;
  avatar?: string;
  role: UserRole;
  department?: string;
  status?: UserStatus;
  permissions?: Permission[] | string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  // Session revocation (Step 3): embedded in JWT, verified on each request.
  // Bumping this logs out every active session for the user.
  tokenVersion?: number;
}

export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  CORPORATE = 'CORPORATE',
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string;
  mobile?: string;
  nationalId?: string;
  nationalCode?: string;
  email?: string;
  company?: string;
  companyName?: string;
  type?: CustomerType | string;
  source?: string;
  city?: string;
  address?: string;
  category?: 'VIP' | 'REGULAR' | 'WHOLESALE' | 'PARTNER';
  leadStage?: 'LEAD' | 'CONTACTED' | 'PROPOSAL_SENT' | 'NEGOTIATION' | 'WON' | 'LOST';
  status?: CustomerStatus | string;
  tags?: string[];
  notes?: string;
  creditLimit?: number;
  assignedUserId?: string;
  assignedUserName?: string;
  leadId?: string;
  leadCode?: string;
  registrationReason?: string; // Reason for registering contact: مشتری, مشتری بالقوه, همکار, تأمین‌کننده, دوست/آشنا, تماس کاری, پیگیری فروش, سایر
  registrationReasonOther?: string; // Free text explanation when registrationReason is 'سایر'
  jobTitle?: string;
  createdAt: string;
  updatedAt?: string;
}

export enum LeadStatus {
  NEW_LEAD = 'NEW_LEAD',
  CONTACTED = 'CONTACTED',
  FOLLOW_UP = 'FOLLOW_UP',
  NEGOTIATION = 'NEGOTIATION',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export type LeadActivityType =
  | 'CALL'
  | 'FOLLOW_UP'
  | 'APPOINTMENT'
  | 'MEETING_RESULT'
  | 'NOTE'
  | 'SMS'
  | 'STATUS_CHANGE';

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  result: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
  jalaliDate: string;
  nextFollowUpDate?: string;
  nextFollowUpJalali?: string;
  taskId?: string;
  appointmentResult?: string;
  newStatus?: LeadStatus | string;
  metadata?: Record<string, any>;
}

export interface LeadFollowUpSummary {
  date: string;
  jalaliDate: string;
  operatorId: string;
  operatorName: string;
  activityType: LeadActivityType | string;
  result: string;
  nextFollowUpDate?: string;
  nextFollowUpJalali?: string;
}

export interface Lead {
  id: string;
  leadCode: string;
  mobile: string;
  name?: string;
  company?: string;
  status: LeadStatus | string;
  source?: string;
  notes?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  convertedCustomerId?: string;
  convertedCustomerName?: string;
  convertedAt?: string;
  lastContactAt?: string;
  interactionCount?: number;
  lastFollowUp?: LeadFollowUpSummary;
  activities?: LeadActivity[];
  nextFollowUpAt?: string;
  nextFollowUpTaskId?: string;
  createdAt: string;
  updatedAt?: string;
}

export enum InteractionType {
  INCOMING_CALL = 'incoming_call',
  OUTGOING_CALL = 'outgoing_call',
  VISIT = 'visit',
  MESSAGE = 'message',
  OTHER = 'other',
}

export interface Interaction {
  id: string;
  customer_id?: string;
  customerId?: string;
  lead_id?: string;
  leadId?: string;
  leadCode?: string;
  customerName?: string;
  customerMobile?: string;
  user_id: string;
  userId?: string;
  userName?: string;
  interaction_type: InteractionType | string;
  interactionType?: InteractionType | string;
  started_at: string;
  startedAt?: string;
  dateTime?: string;
  duration_seconds?: number;
  durationSeconds?: number;
  subject?: string;
  customer_request?: string;
  customerRequest?: string;
  outcome?: string;
  note?: string;
  notes?: string;
  voice_transcript?: string;
  voiceTranscript?: string;
  follow_up_required: boolean;
  followUpRequired?: boolean;
  follow_up_at?: string;
  followUpAt?: string;
  followUpDate?: string;
  follow_up_user_id?: string;
  followUpUserId?: string;
  followUpUserName?: string;
  follow_up_task_id?: string;
  followUpTaskId?: string;
  follow_up_completed?: boolean;
  followUpCompleted?: boolean;
  createTask?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface Call {
  id: string;
  customerId?: string;
  leadId?: string;
  leadCode?: string;
  customerName?: string;
  customerMobile?: string;
  customerPhone?: string;
  userId?: string;
  userName?: string;
  callType: string;
  dateTime?: string;
  durationSeconds?: number;
  subject: string;
  notes: string;
  customerRequest?: string;
  outcome?: string;
  transcript?: string;
  voiceTranscript?: string;
  audioBlobUrl?: string;
  result?: string;
  followUpRequired?: boolean;
  followUpDueDate?: string;
  followUpDate?: string;
  followUpUserId?: string;
  followUpUserName?: string;
  followUpTaskId?: string;
  followUpCompleted?: boolean;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  leadId?: string;
  leadCode?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  sharedWithUserIds?: string[];
  sharedWithUserNames?: string[];
  creatorUserId?: string;
  creatorUserName?: string;
  priority: string | TaskPriority;
  status: string | TaskStatus;
  dueDate: string;
  reminderDate?: string;
  completedAt?: string;
  attachmentIds?: string[];
  tags?: string[];
  voiceNoteAudioUrl?: string;
  voiceNoteDuration?: number;
  voiceNoteTranscript?: string;
  voiceNoteId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName?: string;
  customerNationalId?: string;
  title: string;
  type?: string | ContractType;
  contractType?: string | ContractType;
  startDate?: string;
  endDate?: string;
  amount?: number;
  totalAmount?: number;
  prepaymentAmount?: number;
  prePaymentAmount?: number;
  installmentCount?: number;
  status: string | ContractStatus;
  notes?: string;
  terms?: string;
  termsAndConditions?: string;
  attachmentIds?: string[];
  createdById?: string;
  createdByName?: string;
  signedAt?: string;
  // Financial Snapshot & SIM Fields
  simCardId?: string;
  simNumber?: string;
  saleType?: 'CASH' | 'INSTALLMENT' | 'MORTGAGE' | string;
  saleAmount?: number;
  downPayment?: number;
  financedAmount?: number;
  commissionRate?: number;
  commissionAmount?: number;
  totalContractAmount?: number;
  installmentAmount?: number;
  repaymentMethod?: 'CHECK' | 'BANK_TRANSFER' | string;
  firstDueDate?: string;
  scheduleRule?: 'MONTHLY' | 'BIMONTHLY' | string;
  financialSnapshot?: ContractFinancialSnapshot;
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  receiptNumber?: string;
  customerId: string;
  customerName?: string;
  amount: number;
  date?: string;
  paymentDate?: string;
  description?: string;
  method?: string | PaymentMethod;
  paymentType?: string | PaymentType;
  referenceNumber?: string;
  status?: string | PaymentStatus;
  notes?: string;
  contractId?: string;
  installmentId?: string;
  installmentNumber?: number;
  destinationAccount?: string;
  bankName?: string;
  receiptDocumentId?: string;
  // ارجاع به مدیر مالی / Finance Referral
  referredToUserId?: string;
  referredToUserName?: string;
  referredBy?: string;
  referredAt?: string;
  financeReviewStatus?: 'PENDING_REVIEW' | 'REVIEWED' | 'REJECTED' | string;
  financeNotes?: string;
  financeReviewedBy?: string;
  financeReviewedAt?: string;
  reportedByUserId?: string;
  reportedByUserName?: string;
  recordedByUserId?: string;
  recordedByUserName?: string;
  verifiedByUserId?: string;
  verifiedByUserName?: string;
  verifiedAt?: string;
  finalizedByUserId?: string;
  finalizedByUserName?: string;
  finalizedAt?: string;
  rejectionReason?: string;
  attachmentIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface CheckItem {
  id: string;
  type?: CheckType | string;
  customerId: string;
  customerName?: string;
  issuerName?: string;
  amount: number;
  bankName: string;
  branchName?: string;
  checkNumber?: string;
  sayadNumber?: string;
  issueDate?: string;
  dueDate: string;
  status: CheckStatus | string;
  notes?: string;
  receiverName?: string;
  drawerName?: string;
  depositDate?: string;
  clearanceDate?: string;
  attachmentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Alias for Check
export type Check = CheckItem;

export interface SimCard {
  id: string;
  phoneNumber: string;
  operator: string | SimOperator;
  type?: SimType | string;
  status: string | SimStatus;
  category?: 'ROUND_DIAMOND' | 'ROUND_GOLD' | 'ROUND_SILVER' | 'NORMAL' | string;
  isRound?: boolean;
  roundCategory?: string;
  salePrice?: number;
  costPrice?: number;
  puk?: string;
  pukCode?: string;
  pinCode?: string;
  iccid?: string;
  customerId?: string;
  customerName?: string;
  ownerCustomerId?: string;
  ownerCustomerName?: string;
  notes?: string;
  shelfLocation?: string;
  assignedUserId?: string;
  activatedAt?: string;
  // Registered SIM Holder (مالک ثبتی سیم‌کارت - قاعده حداکثر ۱۰ سیم‌کارت)
  registeredHolderId?: string;
  registeredHolderName?: string;
  ownershipRegistrationDate?: string;
  // Purchase / خرید سیم‌کارت
  purchaseDate?: string;
  purchasePrice?: number;
  sellerCustomerId?: string;
  sellerCustomerName?: string;
  purchaseSourceType?: 'CUSTOMER' | 'INTERNAL';
  purchaseSourceReason?: string;
  purchasePaymentMethod?: string;
  purchaseAmountPaid?: number;
  purchaseAmountRemaining?: number;
  purchaseDescription?: string;
  purchasedByUserId?: string;
  purchasedByUserName?: string;
  // Reservation, Deposit & Cancellation / رزرو و بیعانه و لغو
  reservationCustomerId?: string;
  reservationCustomerName?: string;
  reservedAt?: string;
  reservationExpireAt?: string;
  reservedBy?: string;
  reservationNotes?: string;
  depositAmount?: number;
  depositDate?: string;
  depositPaymentMethod?: string;
  depositPaymentReference?: string;
  depositReceiptDocumentId?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  refundRequired?: boolean;
  refundAmount?: number;
  refundDate?: string;
  refundMethod?: string;
  refundReference?: string;
  refundDocumentId?: string;
  refundStatus?: 'NO_REFUND' | 'FULL_REFUND' | 'PARTIAL_REFUND';
  // Sale & Contract / فروش نقدی، اقساطی یا رهن
  buyerCustomerId?: string;
  buyerCustomerName?: string;
  buyerNationalId?: string;
  buyerMobile?: string;
  deliveryStatus?: string;
  deliveryMethod?: string;
  saleDate?: string;
  saleType?: 'CASH' | 'INSTALLMENT' | 'MORTGAGE';
  saleDescription?: string;
  soldByUserId?: string;
  soldByUserName?: string;
  cashPaymentMethod?: string;
  cashAmountPaid?: number;
  contractId?: string;
  contractNumber?: string;
  // Mortgage / رهن سیم‌کارت
  isMortgaged?: boolean;
  mortgageeName?: string;
  mortgageAmount?: number;
  mortgageStartDate?: string;
  mortgageEndDate?: string;
  mortgageContractRef?: string;
  mortgageReleaseDate?: string;
  originalOwnerCustomerId?: string;
  originalOwnerCustomerName?: string;
  mortgageDate?: string;
  mortgageInitialAmount?: number;
  mortgageRepurchaseAmount?: number;
  mortgageMonthlyCommissionRate?: number;
  mortgageMonthlyCommissionAmount?: number;
  mortgageContractAmount?: number;
  mortgageRepaymentCount?: number;
  mortgageFirstDueDate?: string;
  mortgageRepaymentMethod?: string;
  mortgageNotes?: string;
  mortgageStatus?: 'ACTIVE' | 'REPURCHASED' | 'FORFEITED' | 'OVERDUE';
  // Consignment / امانی
  consignmentId?: string;
  isConsigned?: boolean;
  consignmentStatus?: 'CONSIGNMENT' | 'SOLD' | 'RETURNED' | 'EXPIRED' | string;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// Consignment / سیم‌کارت امانی
// ----------------------------------------------------
export interface ConsignmentContact {
  id: string;
  date: string;
  type: 'CALL' | 'SMS' | 'VISIT' | 'NOTE';
  summary: string;
  userId: string;
  userName: string;
}

export interface Consignment {
  id: string;
  simId: string;
  simPhoneNumber: string;
  ownerCustomerId: string;
  ownerCustomerName: string;
  receivedAt: string;
  requestedPrice: number;
  commissionType: 'PERCENTAGE' | 'FIXED';
  commissionValue: number;
  agreedTerms: string;
  responsibleUserId: string;
  responsibleUserName: string;
  expiryAt?: string;
  status: 'CONSIGNMENT' | 'SOLD' | 'RETURNED' | 'EXPIRED';
  soldAt?: string;
  soldPrice?: number;
  actualCommission?: number;
  ownerPayableAmount?: number;
  settlementStatus?: 'PENDING' | 'PARTIAL' | 'SETTLED';
  settledAt?: string;
  buyerCustomerId?: string;
  buyerCustomerName?: string;
  returnReason?: string;
  returnedAt?: string;
  notes?: string;
  contactHistory?: ConsignmentContact[];
  documents?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface SimEvent {
  id: string;
  simId: string;
  action: string;
  fromStatus?: string;
  toStatus: string;
  fromCustomerId?: string;
  toCustomerId?: string;
  userId: string;
  userName: string;
  notes?: string;
  timestamp: string;
}

export interface RepairTicket {
  id: string;
  trackingCode?: string;
  ticketNumber?: string;
  customerId: string;
  customerName?: string;
  customerMobile?: string;
  customerPhone?: string;
  deviceType?: string;
  brand?: string;
  deviceModel?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  problemDescription: string;
  accessoriesIncluded?: string;
  receivedDate?: string;
  receivedAt?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  technicianUserId?: string;
  technicianUserName?: string;
  technicianNotes?: string;
  status: string | RepairStatus;
  diagnosis?: string;
  workPerformed?: string;
  partsUsed?: string;
  replacedParts?: { name: string; cost: number; quantity: number }[];
  estimatedCost: number;
  finalCost?: number;
  completionDate?: string;
  deliveredDate?: string;
  deliveredAt?: string;
  customerApproved?: boolean;
  warrantyPeriodDays?: number;
  warrantyUntil?: string;
  attachmentIds?: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// Alias for Repair
export type Repair = RepairTicket;

export interface Attachment {
  id: string;
  filename?: string;
  fileName: string;
  originalName?: string;
  displayName?: string; // نمایشی / title خواناتر برای نمایش جدا از نام فیزیکی فایل
  mimeType?: string;
  fileType: string;
  category: string;
  sizeBytes?: number;
  fileSize: number;
  dataUrl?: string;
  url?: string;
  sha256?: string; // فایل SHA-256 checksum برای یکپارچگی
  uploadedByUserId?: string;
  uploadedByUserName: string;
  uploadedAt?: string;
  createdAt?: string;
  updatedByUserId?: string;
  updatedByUserName?: string;
  customerId?: string; // Optional/nullable: allows uploading without customer
  customerName?: string; // Optional/nullable
  leadId?: string;
  leadCode?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  notes?: string;
  title?: string;
  description?: string;
  isSensitive?: boolean; // اسناد حساس → دسترسی خصوصی‌تر
  storageKey?: string; // کلید ذخیره‌سازی خصوصی (بدون URL حدس‌پذیر)
  thumbnailDataUrl?: string; // بندانگشتی سبک برای گرید
  uploadStatus?: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'ERROR'; // جداسازی «دریافت شده» از «در حال پردازش»
  idempotencyKey?: string; // کلید یکتایی برای جلوگیری از آپلود تکراری
  status?: 'ACTIVE' | 'ARCHIVED';
  updatedAt?: string;
}

export enum DevicePlatform {
  WINDOWS = 'WINDOWS',
  MACOS = 'MACOS',
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  LINUX = 'LINUX',
  OTHER = 'OTHER',
}

export interface UserNotificationDevice {
  id: string;
  userId: string;
  userName?: string;
  deviceName: string;
  deviceType?: 'DESKTOP' | 'MOBILE' | 'TABLET' | string;
  platform: DevicePlatform | string;
  browser: string;
  userAgent?: string;
  pushEndpoint?: string;
  pushP256dhKey?: string;
  pushAuthKey?: string;
  pushP256dh?: string;
  pushAuth?: string;
  enabled: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt?: string;
}

export enum DeliveryChannel {
  IN_APP = 'IN_APP',
  WEB_PUSH = 'WEB_PUSH',
  AUDIBLE_IN_APP = 'AUDIBLE_IN_APP',
}

export enum DeliveryStatus {
  SCHEDULED = 'SCHEDULED',
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  OPENED = 'OPENED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  userId: string;
  notificationDeviceId?: string;
  deviceName?: string;
  channel: DeliveryChannel | string;
  status: DeliveryStatus | string;
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  openedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationSettings {
  enableNotifications: boolean;
  enableSound: boolean;
  soundVolume: number; // 0 to 100
  soundChime: 'crystal' | 'bell' | 'chime' | 'subtle';
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string; // e.g. "07:30"
  defaultSnoozeMinutes: number;
}

export interface Notification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  body?: string; // alias for message
  category?: 'TASK' | 'REMINDER' | 'PAYMENT' | 'REPAIR' | 'CUSTOMER' | 'LEAD' | 'CONTRACT' | 'APPROVAL' | 'SYSTEM' | string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | string;
  read: boolean;
  isRead?: boolean;
  readAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedCustomerName?: string;
  relatedLeadName?: string;
  scheduledAt?: string;
  snoozedUntil?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole?: UserRole | string;
  action: string;
  module?: ModuleName | string;
  entityType?: string;
  entityName?: string;
  targetId?: string;
  targetType?: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
  result?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
}

export interface BackupManifest {
  backup_id: string;
  created_at: string;
  database_version: string;
  application_version: string;
  file_count: number;
  database_size: number;
  documents_size: number;
  total_size: number;
  checksum: string;
  documents_by_type?: Record<string, number>;
  database_record_counts?: BackupRecordCounts;
  system_name?: string;
  organization_name?: string;
  created_by_name?: string;
}

export interface BackupTestResult {
  valid: boolean;
  backupId: string;
  checkedAt: string;
  manifestValid: boolean;
  databaseIntegrity: boolean;
  documentsIntegrity: boolean;
  recordCounts: BackupRecordCounts;
  totalFilesVerified: number;
  checksumMatches: boolean;
  stagingSimulated: boolean;
  orphanedFilesCount: number;
  integrityReport: string[];
  warnings: string[];
  errors: string[];
}

export interface CustomerTimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName: string;
  entityId?: string;
  meta?: Record<string, any>;
}

export interface DateSuggestion {
  id: string;
  customerId: string;
  title: string;
  suggestedDate: string;
  alternativeDate?: string;
  confirmedDate?: string;
  status: 'CUSTOMER_SUGGESTED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'REJECTED';
  notes?: string;
  createdAt: string;
}

export interface ShareableLink {
  id: string;
  token: string;
  type: 'PAYMENT' | 'DOCUMENT' | 'APPOINTMENT' | 'CONTRACT_REVIEW' | 'INFO_REQUEST';
  entityId: string;
  customerId: string;
  expiresAt: string;
  isRevoked: boolean;
  accessCount: number;
  lastAccessedAt?: string;
  createdAt: string;
}

export enum VoiceNoteCategory {
  CUSTOMER_NOTE = 'CUSTOMER_NOTE', // یادداشت پرونده مشتری
  CALL_MEMO = 'CALL_MEMO', // شرح مذاکره تلفنی
  TASK_INSTRUCTION = 'TASK_INSTRUCTION', // دستور کار و وظیفه
  REPAIR_DIAGNOSIS = 'REPAIR_DIAGNOSIS', // عیب‌یابی و یادداشت تعمیرگاه
  PAYMENT_APPROVAL = 'PAYMENT_APPROVAL', // دستور پرداخت و تایید مالی
  INTERNAL_MEMO = 'INTERNAL_MEMO', // یادداشت درون‌سازمانی
  GENERAL = 'GENERAL', // یادداشت صوتی عمومی
}

export enum NoteType {
  VOICE = 'VOICE',
  TEXT = 'TEXT',
}

export interface VoiceNote {
  id: string;
  title: string;
  noteType?: NoteType | string; // 'TEXT' => یادداشت متنی | default 'VOICE' (backward compat)
  body?: string; // متن یادداشت متنی؛ برای TEXT الزامی است
  customerId?: string;
  customerName?: string;
  audioDataUrl?: string; // Base64 Data URL (audio/webm, audio/mp4, or audio/wav) — برای TEXT وجود ندارد
  mimeType?: string; // Authoritative container/MIME captured at record time (Step 4)
  fileName?: string; // Display/extension-derived name for downloads (Step 4)
  durationSeconds?: number; // 0 برای TEXT
  transcription?: string;
  category: VoiceNoteCategory | string;
  tags?: string[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  updatedById?: string;
  updatedByName?: string;
  editedAt?: string; // روی هر ویرایش
  relatedEntityType?: 'CUSTOMER' | 'CALL' | 'TASK' | 'REPAIR' | 'CONTRACT' | 'PAYMENT' | 'GENERAL' | string;
  relatedEntityId?: string;
  isPinned?: boolean;
}

export enum ProblemReportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum ProblemReportPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface ProblemReport {
  id: string;
  title: string;
  description: string;
  category?: 'BUG' | 'UI_ISSUE' | 'FEATURE_REQUEST' | 'DATA_SYNC' | 'OTHER' | string;
  priority: ProblemReportPriority | string;
  status: ProblemReportStatus | string;
  screenshotUrl?: string; // base64 data url
  url?: string;
  userAgent?: string;
  userId: string;
  userName: string;
  userRole: UserRole | string;
  userEmail?: string;
  userMobile?: string;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByUserName?: string;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// System Backup & Restore Types
// ----------------------------------------------------
export enum BackupStatus {
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  RUNNING = 'RUNNING',
  VERIFYING = 'VERIFYING',
  RESTORED = 'RESTORED',
}

export enum BackupType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
  SAFETY_PRE_RESTORE = 'SAFETY_PRE_RESTORE',
}

export interface BackupRecordCounts {
  users: number;
  roles: number;
  customers: number;
  leads?: number;
  calls: number;
  interactions: number;
  voiceNotes: number;
  tasks: number;
  contracts: number;
  contractInstallments?: number;
  payments: number;
  checks: number;
  sims: number;
  repairs: number;
  registeredHolders?: number;
  attachments: number;
  accounts?: number;
  journalEntries?: number;
  journalEntryLines?: number;
  accountingPeriods?: number;
  documentShares?: number;
  trustedBiometricDevices?: number;
  notifications: number;
  auditLogs: number;
  settings: number;
  dateSuggestions: number;
  sharedLinks: number;
  problemReports: number;
  totalRecords: number;
}

export interface BackupItem {
  id: string;
  filename: string;
  createdAt: string;
  type: BackupType;
  status: BackupStatus;
  sizeBytes: number;
  sizeFormatted: string;
  checksum: string;
  isEncrypted: boolean;
  version: number;
  revision: number;
  systemName: string;
  organizationName: string;
  createdById: string;
  createdByName: string;
  createdByRole: string;
  counts: BackupRecordCounts;
  fileCounts: {
    attachmentsCount: number;
    voiceNotesCount: number;
    holderIdCardsCount?: number;
    problemReportScreenshotsCount?: number;
    checkPhotosCount?: number;
    contractSignaturesCount?: number;
    totalFilesCount: number;
    filesSizeBytes: number;
  };
  integrityVerified: boolean;
  integrityDetails?: string;
  failureReason?: string;
  notes?: string;
}

export interface BackupScheduleSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'custom';
  backupTime: string; // e.g. "03:00"
  customCron?: string;
  retentionDays: number;
  maxBackupsToKeep: number;
  storagePath?: string;
  encryptBackups: boolean;
  lastRunAt?: string;
  lastRunStatus?: BackupStatus;
  lastRunError?: string;
  nextRunAt?: string;
}

export interface BackupHealthSummary {
  lastSuccessfulBackup: BackupItem | null;
  nextScheduledBackup: string | null;
  frequency: string;
  retentionDays: number;
  maxBackups: number;
  totalBackupsCount: number;
  totalStorageSizeBytes: number;
  totalStorageFormatted: string;
  failedBackupsCount: number;
  backupVerificationStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  storageLocation: string;
  autoBackupEnabled: boolean;
  hasRecentFailure: boolean;
}

export interface BackupVerificationResult {
  valid: boolean;
  checksumMatches: boolean;
  structureValid: boolean;
  usersValid: boolean;
  adminAccountPreserved: boolean;
  rolesValid: boolean;
  filesIntegrity: boolean;
  counts: BackupRecordCounts;
  details: string[];
  errors: string[];
}

export interface RestoreExecutionResult {
  success: boolean;
  message: string;
  safetyBackupId?: string;
  restoredRevision?: number;
  restoredCounts?: BackupRecordCounts;
  verification?: BackupVerificationResult;
  rollbackOccurred?: boolean;
  error?: string;
}

// ----------------------------------------------------
// MMBA Accounting Foundation Types (Double-Entry Bookkeeping)
// ----------------------------------------------------
export enum AccountType {
  ASSET = 'ASSET', // دارایی‌ها
  LIABILITY = 'LIABILITY', // بدهی‌ها
  EQUITY = 'EQUITY', // حقوق صاحبان سهام / سرمایه
  REVENUE = 'REVENUE', // درآمدها
  EXPENSE = 'EXPENSE', // هزینه‌ها
}

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: AccountType | string;
  parent_id?: string;
  is_active: boolean;
  created_at: string;
  description?: string;
}

export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  VOID = 'VOID',
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  debit: number; // بدهکار
  credit: number; // بستانکار
  description?: string;
}

export interface JournalEntry {
  id: string;
  entry_number: number | string;
  entry_date: string; // ISO date / Shamsi recorded
  description: string;
  reference_type?: 'PAYMENT' | 'CONTRACT' | 'INSTALLMENT' | 'MANUAL' | 'HOLO_SYNC' | string;
  reference_id?: string;
  status: JournalEntryStatus | string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_by?: string;
  updated_at?: string;
  lines?: JournalEntryLine[];
  totalDebit?: number;
  totalCredit?: number;
}

export enum AccountingPeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface AccountingPeriod {
  id: string;
  period: string; // e.g. "1403", "1403-Q1", "1404"
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus | string;
  created_at?: string;
  closed_at?: string;
  closed_by?: string;
}

// ----------------------------------------------------
// Internal Document Sharing & Assignment Types
// ----------------------------------------------------
export enum DocumentShareStatus {
  SENT = 'SENT',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export interface DocumentShare {
  id: string;
  document_id: string;
  documentId?: string; // alias
  sender_user_id: string;
  senderUserId?: string;
  sender_user_name: string;
  senderUserName?: string;
  recipient_user_id: string;
  recipientUserId?: string;
  recipient_user_name: string;
  recipientUserName?: string;
  shared_at: string;
  sharedAt?: string;
  message?: string;
  status: DocumentShareStatus | string;
  read_at?: string;
  readAt?: string;
  archived_at?: string;
  archivedAt?: string;
  document_file_name?: string;
  documentFileName?: string;
  document_file_size?: number;
  documentFileSize?: number;
  document_file_type?: string;
  documentFileType?: string;
  customer_id?: string;
  customerId?: string;
  customer_name?: string;
  customerName?: string;
}

// ----------------------------------------------------
// Internal Chat / پیام‌رسانی داخلی (Sprint 03 Patch 05)
// ----------------------------------------------------
export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  BROADCAST = 'BROADCAST',
}

export enum ConversationPriority {
  NORMAL = 'NORMAL',
  IMPORTANT = 'IMPORTANT',
  VERY_IMPORTANT = 'VERY_IMPORTANT',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export enum ChatMemberRole {
  MEMBER = 'MEMBER',
  MANAGER = 'MANAGER', // رزرو شده برای آینده
}

export interface ConversationMember {
  user_id: string;
  userId?: string; // alias
  user_name: string;
  userName?: string; // alias
  role?: ChatMemberRole | string;
  joined_at: string;
  joinedAt?: string; // alias
  last_read_at?: string;
  lastReadAt?: string; // alias
}

export interface ChatConversation {
  id: string;
  type: ConversationType | string;
  title?: string;
  members: ConversationMember[];
  member_ids: string[];
  created_by: string;
  createdById?: string;
  created_by_name: string;
  createdByName?: string;
  created_at: string;
  createdAt?: string;
  last_message?: string;
  lastMessage?: string;
  last_message_at?: string;
  lastMessageAt?: string;
  last_message_user_id?: string;
  lastMessageUserId?: string;
  last_message_user_name?: string;
  lastMessageUserName?: string;
  is_archived_by?: string[];
  isArchivedBy?: string[];
  updated_at?: string;
  updatedAt?: string;
  // Stage 1: Priority & Pin
  priority?: ConversationPriority | string;
  is_pinned?: boolean;
  pinnedByUserId?: string;
  pinned_at?: string;
  message_count?: number;
  // Stage 2: Group fields
  group_name?: string;
  group_description?: string;
  group_image_url?: string;
}

export interface MessageAttachmentRef {
  attachment_id: string;
  attachmentId?: string; // alias
  attachment_name: string;
  attachmentName?: string; // alias
  attachment_file_size?: number;
  attachmentFileSize?: number;
  attachment_file_type?: string;
  attachmentFileType?: string;
}

// Stage 2: MessageAttachment - document_id reference to Document Engine
export interface MessageAttachment {
  id: string;
  message_id: string;
  document_id: string;
  documentFileName?: string;
  documentFileType?: string;
  documentFileSize?: number;
  documentUrl?: string;
  createdAt: string;
}

// Stage 2: MessageAttachment - document_id reference to Document Engine
export interface MessageAttachment {
  id: string;
  message_id: string;
  document_id: string;
  documentFileName?: string;
  documentFileType?: string;
  documentFileSize?: number;
  documentUrl?: string;
  createdAt: string;
}

// Stage 1: ChatMessage extension with deletion fields
export interface ChatMessage {
  id: string;
  conversation_id: string;
  conversationId?: string;
  sender_user_id: string;
  senderUserId?: string;
  sender_user_name: string;
  senderUserName?: string;
  body?: string;
  body_text?: string;
  attachments?: MessageAttachmentRef[];
  status: MessageStatus | string;
  read_at?: string;
  readAt?: string;
  read_by_user_ids?: string[];
  readByUserIds?: string[];
  created_at: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  client_message_id?: string;
  clientMessageId?: string;
  // Stage 1: Soft delete fields
  deleted_at?: string;
  deletedAt?: string;
  deleted_by_user_id?: string;
  deletedByUserId?: string;
  is_edited?: boolean;
  edited_at?: string;
  editedAt?: string;
}

// Stage 3: Broadcast
export enum BroadcastStatus {
  SENDING = 'SENDING',
  SENT = 'SENT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Broadcast {
  id: string;
  sender_user_id: string;
  senderUserId?: string;
  body: string;
  created_at: string;
  createdAt?: string;
  status: BroadcastStatus | string;
  recipient_count?: number;
  read_count?: number;
  sent_count?: number;
  failed_count?: number;
}

export enum BroadcastRecipientStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export interface BroadcastRecipient {
  id: string;
  broadcast_id: string;
  broadcastId?: string;
  user_id: string;
  userId?: string;
  status: BroadcastRecipientStatus | string;
  delivered_at?: string;
  deliveredAt?: string;
  read_at?: string;
  readAt?: string;
  failed_at?: string;
  failedAt?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  conversationId?: string; // alias
  sender_user_id: string;
  senderUserId?: string; // alias
  sender_user_name: string;
  senderUserName?: string; // alias
  body?: string;
  body_text?: string; // alias، متن ساده اختیاری
  attachments?: MessageAttachmentRef[]; // رفرنس به Attachment engine موجود
  status: MessageStatus | string;
  read_at?: string;
  readAt?: string;
  read_by_user_ids?: string[];
  readByUserIds?: string[];
  created_at: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  client_message_id?: string; // کلید idempotency برای بهینه‌گرا
  clientMessageId?: string;
}

// ----------------------------------------------------
// Bulk Contact Import & Duplicate Detection Types
// ----------------------------------------------------
export enum ImportRowStatus {
  NEW = 'NEW',
  DUPLICATE = 'DUPLICATE',
  INVALID = 'INVALID',
}

export interface ContactImportRow {
  rowNumber: number;
  data: Partial<Customer>;
  status: 'NEW' | 'DUPLICATE' | 'INVALID';
  reason?: string;
  normalizedMobile?: string;
  existingCustomerId?: string;
  existingCustomerName?: string;
}

export interface ContactImportMetadata {
  fileName: string;
  importedBy: string;
  importedAt: string;
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  invalidCount: number;
  skipCount: number;
  updateCount: number;
}

// ----------------------------------------------------
// Registered SIM Holders (افراد ثبت‌کننده سیم‌کارت)
// ----------------------------------------------------
export interface RegisteredHolder {
  id: string;
  fullName: string;
  nationalId: string;
  mobile: string;
  shebaNumber?: string;
  activeSimCount?: number;
  maxCapacity?: number;
  remainingCapacity?: number;
  isAtCapacity?: boolean;
  birthDate?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  nationalIdImageUrl?: string;
  nationalIdImageName?: string;
  nationalIdImageSize?: number;
  nationalIdImageType?: string;
  nationalIdImageUploadedBy?: string;
  nationalIdImageUploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: string;
  deleteReason?: string;
}

// ----------------------------------------------------
// Financial Snapshot & Contract Installments
// ----------------------------------------------------
export interface ContractFinancialSnapshot {
  saleAmount: number;
  downPayment: number;
  financedAmount: number;
  commissionRate: number; // e.g. 4.0 or 4.5 %
  commissionAmount: number;
  totalContractAmount: number;
  installmentCount: number;
  installmentAmount: number;
  repaymentMethod: 'CHECK' | 'BANK_TRANSFER' | string;
  firstDueDate: string;
  scheduleRule: 'MONTHLY' | 'BIMONTHLY' | string;
  saleType: 'CASH' | 'INSTALLMENT' | 'MORTGAGE' | string;
}

export enum InstallmentStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export interface ContractInstallment {
  id: string;
  contractId: string;
  simCardId?: string;
  simNumber?: string;
  customerId: string;
  customerName?: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  commissionAmount: number;
  totalDue: number;
  totalAmount?: number;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  notes?: string;
  repaymentMethod?: 'CHECK' | 'BANK_TRANSFER' | string;
  checkNumber?: string;
  bankName?: string;
  destinationAccount?: string;
  payments?: Payment[];
  createdAt: string;
  updatedAt?: string;
}

export enum FinanceReviewStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  REVIEWED = 'REVIEWED',
  REJECTED = 'REJECTED',
}

// ----------------------------------------------------
// Biometric Authentication & Trusted Devices (WebAuthn / Passkey)
// ----------------------------------------------------
export interface TrustedBiometricDevice {
  id: string;
  userId: string;
  credentialId: string;
  deviceName: string;
  deviceType: 'TOUCH_ID' | 'FACE_ID' | 'ANDROID_BIOMETRIC' | 'WINDOWS_HELLO' | 'SECURITY_KEY' | string;
  userAgent?: string;
  createdAt: string;
  lastUsedAt?: string;
  isRevoked: boolean;
  revokedAt?: string;
  publicKey?: string;
}




