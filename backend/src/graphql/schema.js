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

  """
  An extracted knowledge-base entity. entityType and data are intentionally
  open-ended — Cortex extracts whatever entity types the AI identifies in a
  document rather than a fixed set, so data's shape varies by entityType.
  """
  type Entity {
    id: ID!
    entityType: String!
    data: JSON!
    sourceType: String!
    sourceEmailId: ID
    sourceAttachmentId: String
    rawTextSnippet: String
    confidence: Float
    status: String!
    extractedAt: String
    createdAt: String
    updatedAt: String
  }

  enum EntityListField {
    id
    entityType
    status
    sourceType
    sourceEmailId
    confidence
    extractedAt
    createdAt
  }

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
