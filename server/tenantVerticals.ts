// ---------------------------------------------------------------------------
// Step 12 — Registry of tenant-scoped repositories for every tenant-owned table
// ---------------------------------------------------------------------------
import { createTenantRepository } from './tenantRepository';

const COLUMNS: Record<string, string[]> = {
  lead: ['id', 'tenantId', 'leadCode', 'mobile', 'name', 'company', 'status', 'source', 'notes', 'assignedUserId', 'assignedUserName', 'convertedCustomerId', 'convertedCustomerName', 'convertedAt', 'lastContactAt', 'interactionCount', 'lastFollowUp', 'activities', 'nextFollowUpAt', 'nextFollowUpTaskId', 'createdAt', 'updatedAt', 'deletedAt'],
  interaction: ['id', 'tenantId', 'customerId', 'leadId', 'leadCode', 'customerName', 'customerMobile', 'userId', 'userName', 'interactionType', 'startedAt', 'durationSeconds', 'subject', 'customerRequest', 'outcome', 'note', 'voiceTranscript', 'followUpRequired', 'followUpAt', 'followUpUserId', 'followUpTaskId', 'followUpCompleted', 'createdAt', 'updatedAt'],
  voiceNote: ['id', 'tenantId', 'title', 'noteType', 'body', 'customerId', 'customerName', 'storageKey', 'mimeType', 'fileName', 'durationSeconds', 'transcription', 'category', 'tags', 'createdById', 'createdByName', 'updatedById', 'updatedByName', 'editedAt', 'relatedEntityType', 'relatedEntityId', 'isPinned', 'createdAt', 'updatedAt'],
  task: ['id', 'tenantId', 'title', 'description', 'customerId', 'customerName', 'leadId', 'leadCode', 'assignedUserId', 'assignedUserName', 'sharedWithUserIds', 'creatorUserId', 'creatorUserName', 'priority', 'status', 'dueDate', 'reminderDate', 'completedAt', 'tags', 'createdAt', 'updatedAt', 'deletedAt'],
  contract: ['id', 'tenantId', 'contractNumber', 'customerId', 'customerName', 'customerNationalId', 'title', 'type', 'contractType', 'startDate', 'endDate', 'amount', 'totalAmount', 'prepaymentAmount', 'installmentCount', 'status', 'notes', 'terms', 'termsAndConditions', 'attachmentIds', 'createdById', 'createdByName', 'signedAt', 'simCardId', 'simNumber', 'saleType', 'financialSnapshot', 'createdAt', 'updatedAt', 'deletedAt'],
  payment: ['id', 'tenantId', 'receiptNumber', 'customerId', 'customerName', 'amount', 'date', 'paymentDate', 'description', 'method', 'paymentType', 'referenceNumber', 'status', 'notes', 'contractId', 'installmentId', 'installmentNumber', 'destinationAccount', 'bankName', 'financeReviewStatus', 'verifiedByUserId', 'verifiedByName', 'verifiedAt', 'finalizedByUserId', 'finalizedByName', 'finalizedAt', 'createdAt', 'updatedAt', 'deletedAt'],
  checkRecord: ['id', 'tenantId', 'type', 'customerId', 'customerName', 'issuerName', 'amount', 'bankName', 'branchName', 'checkNumber', 'sayadNumber', 'issueDate', 'dueDate', 'status', 'notes', 'depositDate', 'clearanceDate', 'attachmentIds', 'createdAt', 'updatedAt', 'deletedAt'],
  simCard: ['id', 'tenantId', 'phoneNumber', 'operator', 'type', 'status', 'category', 'isRound', 'roundCategory', 'salePrice', 'costPrice', 'puk', 'pukCode', 'pinCode', 'iccid', 'customerId', 'customerName', 'ownerCustomerId', 'ownerCustomerName', 'notes', 'shelfLocation', 'assignedUserId', 'createdAt', 'updatedAt', 'deletedAt'],
  repair: ['id', 'tenantId', 'trackingCode', 'ticketNumber', 'customerId', 'customerName', 'customerMobile', 'customerPhone', 'deviceType', 'brand', 'deviceModel', 'model', 'serialNumber', 'imei', 'problemDescription', 'status', 'diagnosis', 'workPerformed', 'partsUsed', 'estimatedCost', 'finalCost', 'completionDate', 'deliveredDate', 'customerApproved', 'createdAt', 'updatedAt', 'deletedAt'],
  consignment: ['id', 'tenantId', 'simId', 'ownerCustomerId', 'ownerCustomerName', 'receivedAt', 'requestedPrice', 'commissionType', 'commissionValue', 'agreedTerms', 'responsibleUserId', 'responsibleUserName', 'expiryAt', 'status', 'soldAt', 'soldPrice', 'actualCommission', 'ownerPayableAmount', 'settlementStatus', 'settledAt', 'buyerCustomerId', 'buyerCustomerName', 'returnReason', 'returnedAt', 'notes', 'contactHistory', 'documents', 'createdAt', 'updatedAt'],
  chatConversation: ['id', 'tenantId', 'type', 'title', 'priority', 'status', 'createdById', 'createdAt', 'updatedAt', 'deletedAt'],
  chatMessage: ['id', 'tenantId', 'conversationId', 'senderId', 'content', 'status', 'isRead', 'isDeleted', 'attachments', 'createdAt', 'updatedAt'],
  attachment: ['id', 'tenantId', 'customerId', 'customerName', 'storageKey', 'fileName', 'mimeType', 'sizeBytes', 'checksum', 'relatedEntityType', 'relatedEntityId', 'createdAt', 'updatedAt'],
  notification: ['id', 'tenantId', 'userId', 'title', 'message', 'body', 'category', 'priority', 'read', 'snoozedUntil', 'relatedEntityType', 'relatedEntityId', 'relatedCustomerName', 'createdAt', 'updatedAt'],
  auditLog: ['id', 'tenantId', 'timestamp', 'userId', 'userName', 'userRole', 'action', 'module', 'entityType', 'entityName', 'targetId', 'targetType', 'details', 'ipAddress', 'fieldName', 'oldValue', 'newValue', 'result', 'requestId', 'createdAt'],
  broadcast: ['id', 'tenantId', 'title', 'body', 'status', 'createdById', 'createdAt', 'updatedAt'],
  broadcastRecipient: ['id', 'tenantId', 'broadcastId', 'userId', 'status', 'sentAt', 'deliveredAt', 'createdAt'],
  chatParticipant: ['id', 'tenantId', 'conversationId', 'userId', 'role', 'joinedAt', 'leftAt'],
  messageReaction: ['id', 'tenantId', 'messageId', 'userId', 'emoji', 'createdAt'],
  chatMessageReadReceipt: ['id', 'tenantId', 'messageId', 'userId', 'readAt'],
  contractInstallment: ['id', 'tenantId', 'contractId', 'simCardId', 'simNumber', 'customerId', 'customerName', 'installmentNumber', 'dueDate', 'principalAmount', 'commissionAmount', 'totalDue', 'totalAmount', 'paidAmount', 'remainingAmount', 'status', 'notes', 'repaymentMethod', 'checkNumber', 'bankName', 'destinationAccount', 'createdAt', 'updatedAt'],
  registeredHolder: ['id', 'tenantId', 'fullName', 'nationalId', 'mobile', 'shebaNumber', 'activeSimCount', 'maxCapacity', 'remainingCapacity', 'isAtCapacity', 'birthDate', 'address', 'notes', 'isActive', 'nationalIdImageUrl', 'createdAt', 'updatedAt', 'isDeleted', 'deletedAt'],
  dateSuggestion: ['id', 'tenantId', 'customerId', 'jalaliDate', 'operatorId', 'operatorName', 'activityType', 'result', 'nextFollowUpDate', 'taskId', 'metadata', 'createdAt'],
  shareableLink: ['id', 'tenantId', 'token', 'relatedEntityId', 'relatedEntityType', 'accessCount', 'isRevoked', 'createdById', 'createdAt'],
  problemReport: ['id', 'tenantId', 'title', 'description', 'category', 'priority', 'status', 'screenshotUrl', 'url', 'userAgent', 'userId', 'userName', 'userRole', 'userEmail', 'userMobile', 'adminNotes', 'resolvedAt', 'resolvedByUserId', 'resolvedByUserName', 'createdAt', 'updatedAt'],
  documentShare: ['id', 'tenantId', 'documentId', 'documentType', 'sharedWith', 'status', 'createdById', 'createdAt', 'updatedAt'],
  leadActivity: ['id', 'tenantId', 'leadId', 'type', 'result', 'operatorId', 'operatorName', 'jalaliDate', 'nextFollowUpDate', 'taskId', 'metadata', 'createdAt'],
  notificationDelivery: ['id', 'tenantId', 'notificationId', 'userId', 'channel', 'status', 'sentAt', 'deliveredAt', 'failedAt', 'errorMessage', 'createdAt'],
  account: ['id', 'tenantId', 'code', 'name', 'accountType', 'isActive', 'parentId', 'description', 'createdAt', 'updatedAt', 'deletedAt'],
  journalEntry: ['id', 'tenantId', 'entryNumber', 'entryDate', 'description', 'referenceType', 'referenceId', 'status', 'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'deletedAt'],
  journalEntryLine: ['id', 'tenantId', 'journalEntryId', 'accountId', 'debit', 'credit', 'description', 'createdAt'],
};

const REPOS = new Map<string, ReturnType<typeof createTenantRepository>>();
for (const [table, cols] of Object.entries(COLUMNS)) {
  REPOS.set(table, createTenantRepository(table, cols));
}

/** Get the tenant-scoped repository for a table; null if not registered. */
export function getTenantRepo(table: string) {
  return REPOS.get(table) || null;
}

export const tenantTables = Object.keys(COLUMNS);