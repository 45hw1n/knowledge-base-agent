const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar JSON
  scalar Upload

  type GrantedScopes {
    PROFILE: Boolean
    EMAIL: Boolean
    OPENID: Boolean
    GMAIL_READONLY: Boolean
  }

  type User {
    id: ID!
    displayName: String
    email: String
    image: String
    grantedScopes: GrantedScopes
    gmailAuthRevoked: Boolean
  }

  type SyncEmailsResult {
    success: Boolean!
    message: String
    processedCount: Int
  }

  input ProcessEmailsInput {
    ids: [String]
    status: String
    limit: Int
  }

  type ProcessEmailsResult {
    success: Boolean!
    message: String
    queuedCount: Int
  }

  type GetEmailsToProcessResponse {
    count: Int!
    ids: [ID!]!
  }

  input GetEmailsByStatusInput {
    statuses: [String!]!
  }

  type EmailsByStatus {
    status: String!
    ids: [ID!]!
  }

  type GetEmailsToProcessByStatusResponse {
    count: Int!
    data: [EmailsByStatus!]!
  }

  input LookbackWindowInput {
    value: Int!
    unit: String! # only "DAYS" supported for now
  }

  input BackfillEmailsInput {
    lookback: LookbackWindowInput
    sinceDate: String # ISO date (YYYY-MM-DD); Either lookback OR sinceDate must be provided (not both)
  }

  type SyncResult {
    success: Boolean!
    message: String
    processedCount: Int
  }

  enum EmailSyncStatus {
    IDLE
    SYNC_IN_PROGRESS
  }

  type AppStatus {
    userId: ID!
    emailLastSyncedAt: String
    emailSyncStatus: EmailSyncStatus
    emailProcessingInProgress: Boolean
    lastEmailAIProcessStartedAt: String
    lastEmailAIProcessCompletedAt: String
    lastEmailAIProcessedCount: Int
    createdAt: String
    updatedAt: String
  }

  input UpdateAppStatusInput {
    emailLastSyncedAt: String
  }

  type UserPreferences {
    id: ID!
    userId: ID!
    emailSyncStartDate: String
    createdAt: String
    updatedAt: String
    autoProcess: Boolean!
    isBetaUser: Boolean!
  }

  input UpdateUserPreferencesInput {
    emailSyncStartDate: String
    autoProcess: Boolean
    isBetaUser: Boolean
  }

  type Error {
    code: String!
    message: String!
  }

  type ApiResponse {
    success: Boolean!
    error: Error
  }

  enum ListLogicalOperator {
    AND
    OR
  }

  enum ListComparisonOperator {
    is
    isNot
    in
    notIn
    contains
    startsWith
    gt
    gte
    lt
    lte
    between
    exists
  }

  enum ListSortOrder {
    ASC
    DESC
  }

  type ListInfo {
    page: Int!
    pageSize: Int!
    sort: JSON!
    conditions: JSON
  }

  type ListPagination {
    total: Int!
    totalPages: Int!
    hasNext: Boolean!
    hasPrevious: Boolean!
  }

  type ListMeta {
    executionTime: Int!
    cached: Boolean!
  }

  enum EntityType {
    TICKET
    INVOICE
    PAYMENT
    EVENT
    DOCUMENT
  }

  enum ExtractionStatus {
    PENDING
    PROCESSING
    SUCCESS
    FAILED
  }

  type EntitySource {
    type: String!
    provider: String!
    url: String!
    emailId: ID
    threadId: ID
  }

  type EntityExtraction {
    status: ExtractionStatus!
    model: String
    confidence: Float
    extractedAt: String
  }

  """
  The top-level registry of everything Cortex knows — NOT the complete
  business object. Resolve type + entityId (via the entityDetail query) to
  fetch the typed Invoice/Payment/Ticket/Event/Document.
  """
  type Entity {
    id: ID!
    userId: ID!
    type: EntityType!
    displayId: String!
    title: String!
    source: EntitySource!
    entityId: ID!
    extraction: EntityExtraction!
    createdAt: String
    updatedAt: String
  }

  enum EntityListField {
    id
    type
    displayId
    title
    sourceType
    extractionStatus
    extractionConfidence
    extractedAt
    createdAt
  }

  type Person {
    name: String
    email: String
  }

  type Money {
    value: Float!
    currency: String
  }

  type AttachmentRef {
    attachmentId: String!
    fileName: String!
  }

  enum ConversationDirection {
    SENT
    RECEIVED
  }

  type ConversationMessage {
    messageId: String!
    direction: ConversationDirection!
    content: String!
    timestamp: String!
    attachments: [AttachmentRef!]!
  }

  enum InvoiceStatus {
    UNPAID
    PARTIALLY_PAID
    PAID
    OVERDUE
  }

  type Invoice {
    id: ID!
    userId: ID!
    invoiceNumber: String
    amount: Money!
    dueDate: String
    issuer: Person
    status: InvoiceStatus!
    conversation: [ConversationMessage!]!
    sourceUrl: String!
    sourceType: String!
    threadId: String
    messageId: String
    metadata: JSON
    createdAt: String
    updatedAt: String
    linkedPayments: [Payment!]!
  }

  enum PaymentLinkMethod {
    THREAD_CONTEXT
    RECONCILED
    MANUAL
  }

  type Payment {
    id: ID!
    userId: ID!
    amount: Money!
    paidAt: String!
    payer: Person
    payee: Person
    invoiceId: ID
    linkMethod: PaymentLinkMethod
    sourceUrl: String!
    sourceType: String!
    threadId: String
    messageId: String
    metadata: JSON
    createdAt: String
    updatedAt: String
    invoice: Invoice
  }

  enum TicketStatus {
    OPEN
    IN_PROGRESS
    ON_HOLD
    RESOLVED
    CLOSED
  }

  enum TicketLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type Ticket {
    id: ID!
    userId: ID!
    ticketNumber: String
    title: String!
    summary: String
    status: TicketStatus!
    urgency: TicketLevel
    priority: TicketLevel
    dueDate: String
    assignee: Person
    requester: Person
    conversation: [ConversationMessage!]!
    parentTicketId: ID
    duplicateOfTicketId: ID
    sourceUrl: String!
    sourceType: String!
    threadId: String
    messageId: String
    metadata: JSON
    createdAt: String
    updatedAt: String
    parentTicket: Ticket
    duplicateOfTicket: Ticket
  }

  type EventAttachmentRef {
    documentId: String!
    filename: String!
    document: Document
  }

  type Event {
    id: ID!
    userId: ID!
    title: String!
    description: String
    startTime: String!
    endTime: String
    timezone: String
    location: String
    url: String
    attendees: [Person!]!
    organizer: Person
    attachments: [EventAttachmentRef!]!
    sourceUrl: String!
    sourceType: String!
    threadId: String
    messageId: String
    metadata: JSON
    createdAt: String
    updatedAt: String
  }

  enum KnowledgeDocumentType {
    CONTRACT
    NDA
    TERMS_AND_CONDITIONS
    PRIVACY_POLICY
    COMPLIANCE
    CERTIFICATE
    LICENSE
    AGREEMENT
    POLICY
    OTHER
  }

  type Party {
    name: String!
    role: String
  }

  type Document {
    id: ID!
    userId: ID!
    type: KnowledgeDocumentType!
    title: String!
    description: String
    summary: String!
    documentNumber: String
    issuer: Person
    parties: [Party!]!
    effectiveDate: String
    expiryDate: String
    attachments: [AttachmentRef!]!
    sourceUrl: String!
    sourceType: String!
    threadId: String
    messageId: String
    metadata: JSON
    createdAt: String
    updatedAt: String
  }

  union EntityDetail = Invoice | Payment | Ticket | Event | Document

  input EntityListSortInput {
    attribute: EntityListField!
    order: ListSortOrder!
  }

  input EntityListConditionInput {
    operator: String!
    attribute: EntityListField
    value: JSON
    operands: [EntityListConditionInput!]
  }

  input EntityListRequestInput {
    page: Int
    pageSize: Int
    sort: [EntityListSortInput!]
    conditions: EntityListConditionInput
  }

  type EntityListResponse {
    data: [Entity!]!
    listInfo: ListInfo!
    pagination: ListPagination!
    meta: ListMeta!
  }

  """
  Generic attachment infrastructure — shared across every entity that can
  hold attachments (profiles, workspaces, recurring payments today; new
  Cortex entity types register their own handler as they're added).
  """
  enum AttachmentEntityType {
    RECURRING_PAYMENT
    PROFILE
    WORKSPACE
  }

  type Attachment {
    id: ID!
    fileName: String!
    mimeType: String!
    size: Int!
    uploadedAt: String!
  }

  enum AttachmentUploadStatus {
    SUCCESS
    PARTIAL
    FAILURE
  }

  enum AttachmentFileStatus {
    SUCCESS
    FAILED
  }

  enum AttachmentErrorCode {
    FILE_TOO_LARGE
    UNSUPPORTED_FILE_TYPE
    UPLOAD_FAILED
    ATTACHMENT_LIMIT_EXCEEDED
  }

  """
  The backend owns the entire upload: it receives file bytes over a GraphQL
  multipart request (the Upload scalar), uploads them to Cloudflare R2
  itself, and persists metadata into the owning entity in one round trip.
  """
  input UploadAttachmentsInput {
    entityType: AttachmentEntityType!
    entityId: ID!
    files: [Upload!]!
  }

  type AttachmentFileResult {
    attachmentId: ID!
    fileName: String!
    status: AttachmentFileStatus!
    errorCode: AttachmentErrorCode
  }

  type UploadAttachmentsPayload {
    entityType: AttachmentEntityType!
    entityId: ID!
    status: AttachmentUploadStatus!
    files: [AttachmentFileResult!]!
    attachments: [Attachment!]!
  }

  input DeleteAttachmentInput {
    entityType: AttachmentEntityType!
    entityId: ID!
    attachmentId: ID!
  }

  input AttachmentDownloadUrlInput {
    entityType: AttachmentEntityType!
    entityId: ID!
    attachmentId: ID!
  }

  type Query {
    hello: String
    ping: String
    currentUser: User
    getAppStatus: AppStatus!
    getUserPreferences: UserPreferences
    getEmailsToProcess: GetEmailsToProcessResponse!
    getEmailsToProcessByStatus(
      input: GetEmailsByStatusInput!
    ): GetEmailsToProcessByStatusResponse!
    loginWithGoogle: String!
    getAttachmentDownloadUrl(input: AttachmentDownloadUrlInput!): String!
    entities(input: EntityListRequestInput): EntityListResponse!
    entity(id: ID!): Entity
    entityDetail(id: ID!): EntityDetail
  }

  type Mutation {
    syncEmails: SyncEmailsResult
    backfillEmails(input: BackfillEmailsInput!): SyncResult!
    processEmails(input: ProcessEmailsInput): ProcessEmailsResult
    updateAppStatus(input: UpdateAppStatusInput!): AppStatus
    testMutation(input: String!): String
    logout: Boolean!
    updateUserPreferences(input: UpdateUserPreferencesInput!): UserPreferences!
    uploadAttachments(input: UploadAttachmentsInput!): UploadAttachmentsPayload!
    deleteAttachment(input: DeleteAttachmentInput!): Boolean!
  }
`;

module.exports = typeDefs;
