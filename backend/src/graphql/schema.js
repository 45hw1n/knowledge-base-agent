const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar JSON
  scalar Upload

  type GrantedScopes {
    PROFILE: Boolean
    EMAIL: Boolean
    OPENID: Boolean
    GMAIL_READONLY: Boolean
    SPREADSHEETS: Boolean
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

  input ProcessDebitEmailsInput {
    ids: [String]
    status: String
    limit: Int
  }

  type ProcessDebitEmailsResult {
    success: Boolean!
    message: String
    queuedCount: Int
  }

  type GetDebitEmailsToProcessResponse {
    count: Int!
    ids: [ID!]!
  }

  input GetDebitEmailsByStatusInput {
    statuses: [String!]!
  }

  type DebitEmailsByStatus {
    status: String!
    ids: [ID!]!
  }

  type GetDebitEmailsToProcessByStatusResponse {
    count: Int!
    data: [DebitEmailsByStatus!]!
  }

  enum BackfillMode {
    STANDARD
    ONBOARDING_BACKFILL
  }

  input LookbackWindowInput {
    value: Int!
    unit: String! # only "DAYS" supported for now
  }

  input BackfillEmailsInput {
    lookback: LookbackWindowInput
    sinceDate: String # ISO date (YYYY-MM-DD); Either lookback OR sinceDate must be provided (not both)
    mode: BackfillMode = STANDARD
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
    onboarded: Boolean
    emailSyncStatus: EmailSyncStatus
    debitProcessingInProgress: Boolean
    lastDebitAIProcessStartedAt: String
    lastDebitAIProcessCompletedAt: String
    lastDebitAIProcessedCount: Int
    showPrivateEntity: Boolean
    createdAt: String
    updatedAt: String
  }

  input UpdateAppStatusInput {
    emailLastSyncedAt: String
    onboarded: Boolean
    showPrivateEntity: Boolean
  }

  type UserPreferences {
    id: ID!
    userId: ID!
    salaryCycleDay: Int
    monthlyBudget: Float
    emailSyncStartDate: String
    googleSheetId: String
    createdAt: String
    updatedAt: String
    autoProcess: Boolean!
    isBetaUser: Boolean!
  }

  input UpdateUserPreferencesInput {
    salaryCycleDay: Int
    monthlyBudget: Float
    emailSyncStartDate: String
    autoProcess: Boolean
    isBetaUser: Boolean
  }

  input OnboardUserInput {
    isBetaUser: Boolean!
    autoProcess: Boolean!
    googleSheetId: String!
  }

  type OnboardUserData {
    isBetaUser: Boolean!
    autoProcess: Boolean!
    googleSheetId: String!
    onboarded: Boolean!
  }

  type OnboardUserResponse {
    success: Boolean!
    message: String!
    data: OnboardUserData!
  }

  type InstrumentSignals {
    upiId: String
    cardLast4: String
    cardType: String
    bank: String
    bankAccountLast4: String
  }

  type LLMConfidence {
    overall: Float
    paymentSource: Float
  }

  type LLMMeta {
    confidence: LLMConfidence
    instrumentSignals: InstrumentSignals
  }

  type Error {
    code: String!
    message: String!
  }

  type ApiResponse {
    success: Boolean!
    error: Error
  }

  type BankAccountResponse {
    success: Boolean!
    error: Error
    data: BankAccount
  }

  type CreditCardResponse {
    success: Boolean!
    error: Error
    data: CreditCard
  }

  type DebitCard {
    id: ID
    name: String
    last4: String
    expiryMonth: Int
    expiryYear: Int
    network: String
  }

  type BankAccount {
    id: ID!
    name: String!
    bank: String!
    last4: String!
    accountType: String!
    upiIds: [String]
    debitCards: [DebitCard]
    isPrimary: Boolean!
    isActive: Boolean!
    openingBalance: Float
    createdAt: String
    updatedAt: String
  }

  type CreditCard {
    id: ID!
    name: String!
    bank: String!
    last4: String!
    expiryMonth: Int!
    expiryYear: Int!
    network: String
    billingCycleDay: Int!
    dueDateDay: Int!
    creditLimit: Float
    linkedBankAccountId: ID
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  input DebitCardInput {
    name: String
    last4: String!
    expiryMonth: Int!
    expiryYear: Int!
    network: String
  }

  input CreateBankAccountInput {
    name: String!
    bank: String!
    last4: String!
    accountType: String!
    isPrimary: Boolean
    openingBalance: Float
    upiIds: [String!]
    debitCards: [DebitCardInput!]
  }

  input UpdateBankAccountInput {
    name: String
    bank: String
    last4: String
    accountType: String
    upiIds: [String]
    debitCards: [DebitCardInput]
    isPrimary: Boolean
    openingBalance: Float
  }

  input CreateCreditCardInput {
    name: String!
    bank: String!
    last4: String!
    expiryMonth: Int!
    expiryYear: Int!
    network: String
    billingCycleDay: Int!
    dueDateDay: Int!
    creditLimit: Float
    linkedBankAccountId: ID
  }

  input UpdateCreditCardInput {
    name: String
    bank: String
    last4: String
    expiryMonth: Int
    expiryYear: Int
    network: String
    billingCycleDay: Int
    dueDateDay: Int
    creditLimit: Float
    linkedBankAccountId: ID
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

  enum CreditCardListField {
    id
    name
    bank
    last4
    network
    expiryMonth
    expiryYear
    billingCycleDay
    dueDateDay
    creditLimit
    isActive
    createdAt
    updatedAt
  }

  input ListSortInput {
    attribute: CreditCardListField!
    order: ListSortOrder!
  }

  input ListConditionInput {
    operator: String!
    attribute: CreditCardListField
    value: JSON
    operands: [ListConditionInput!]
  }

  input CreditCardListRequestInput {
    page: Int
    pageSize: Int
    sort: [ListSortInput!]
    conditions: ListConditionInput
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

  type CreditCardListResponse {
    data: [CreditCard!]!
    listInfo: ListInfo!
    pagination: ListPagination!
    meta: ListMeta!
  }

  type TransactionCategory {
    id: String
    value: String
    label: String
  }

  type PaymentSource {
    kind: String!
    instrumentId: ID!
    displayName: String
    last4: String
    bank: String
  }

  type Transaction {
    paymentSource: PaymentSource
    id: ID!
    displayId: String!
    amount: Float!
    currency: String!
    type: String!
    date: String!
    name: String!
    merchant: String!
    merchantNormalized: String
    notes: String
    category: TransactionCategory
    subCategory: TransactionCategory
    paymentMode: String!
    source: String
    cycle: String!
    isCreditCardRepayment: Boolean!
    isPrivate: Boolean!
    isEmiInstallment: Boolean!
    approvalActor: String
    sheetSyncStatus: String
    attachments: [Attachment!]!
    createdAt: String!
    updatedAt: String
  }

  enum TransactionsListField {
    id
    createdAt
    updatedAt
    date
    amount
    type
    merchant
    category
    subCategory
    paymentMode
    source
    cycle
    name
    isCreditCardRepayment
    isPrivate
    isEmiInstallment
    isDeleted
    sheetSyncStatus
    approvalActor
  }

  input TransactionsListSortInput {
    attribute: TransactionsListField!
    order: ListSortOrder!
  }

  input TransactionsListConditionInput {
    operator: String!
    attribute: TransactionsListField
    value: JSON
    operands: [TransactionsListConditionInput!]
  }

  input TransactionsListInfoInput {
    page: Int
    pageSize: Int
    sort: [TransactionsListSortInput!]
    conditions: TransactionsListConditionInput
  }

  input GetTransactionsInput {
    listInfo: TransactionsListInfoInput
  }

  type TransactionListSortEntry {
    attribute: TransactionsListField!
    order: ListSortOrder!
  }

  type TransactionListInfo {
    page: Int!
    pageSize: Int!
    sort: [TransactionListSortEntry!]!
    conditions: JSON
  }

  type TransactionsListResponse {
    data: [Transaction!]!
    listInfo: TransactionListInfo!
    pagination: ListPagination!
    meta: ListMeta!
  }

  enum TransactionWidgetType {
    TOTAL_SPENDS
    SPEND_BY_CATEGORY
    CREDIT_CARD_SPENDS
    TOP_MERCHANTS
    PAYMENT_MODES
    TREND
  }

  input TransactionWidgetRequestInput {
    type: TransactionWidgetType!
    config: JSON
  }

  input GetTransactionWidgetsInput {
    conditions: TransactionsListConditionInput!
    widgets: [TransactionWidgetRequestInput!]!
  }

  type TotalSpendsWidget {
    amount: Float!
    transactionCount: Int!
  }

  type SpendByCategoryItem {
    category: String!
    amount: Float!
    percent: Float!
    transactionCount: Int!
  }

  type SpendByCategoryWidget {
    total: Float!
    categories: [SpendByCategoryItem!]!
  }

  type CreditCardSpendItem {
    name: String!
    amount: Float!
    percent: Float!
  }

  type CreditCardSpendsWidget {
    total: Float!
    cards: [CreditCardSpendItem!]!
  }

  type TopMerchantItem {
    merchant: String!
    amount: Float!
    percent: Float!
    transactionCount: Int!
  }

  type TopMerchantsWidget {
    total: Float!
    merchants: [TopMerchantItem!]!
  }

  type PaymentModeItem {
    mode: String!
    amount: Float!
    percent: Float!
    transactionCount: Int!
  }

  type PaymentModesWidget {
    total: Float!
    modes: [PaymentModeItem!]!
  }

  type TrendPoint {
    date: String!
    amount: Float!
  }

  type TrendWidget {
    total: Float!
    points: [TrendPoint!]!
  }

  type TransactionWidgetsMap {
    TOTAL_SPENDS: TotalSpendsWidget
    SPEND_BY_CATEGORY: SpendByCategoryWidget
    CREDIT_CARD_SPENDS: CreditCardSpendsWidget
    TOP_MERCHANTS: TopMerchantsWidget
    PAYMENT_MODES: PaymentModesWidget
    TREND: TrendWidget
  }

  type TransactionWidgetsData {
    widgets: TransactionWidgetsMap!
  }

  type TransactionWidgetsResponse {
    data: TransactionWidgetsData!
  }

  type TransactionToReviewCategory {
    id: String
    value: String
    label: String
  }

  type TransactionToReviewPaymentSource {
    kind: String!
    instrumentId: ID!
    displayName: String
    last4: String
    bank: String
  }

  type TransactionToReview {
    id: ID!
    amount: Float!
    currency: String
    merchant: String!
    merchantRaw: String
    name: String
    status: String!
    category: TransactionToReviewCategory
    subCategory: TransactionToReviewCategory
    paymentMode: String
    paymentSource: TransactionToReviewPaymentSource
    isCreditCardRepayment: Boolean
    isPrivate: Boolean
    type: String
    date: String
    cycle: String
    notes: String
    referenceId: String
    aiConfidence: Float
    approvedAt: String
    transactionId: ID
    rejectedAt: String
    rejectionNote: String
    attachments: [Attachment!]!
    createdAt: String!
    updatedAt: String
  }

  enum TransactionsToReviewListField {
    id
    createdAt
    updatedAt
    status
    amount
    merchant
    category
    paymentMode
    type
    date
  }

  input TransactionsToReviewListSortInput {
    attribute: TransactionsToReviewListField!
    order: ListSortOrder!
  }

  input TransactionsToReviewListConditionInput {
    operator: String!
    attribute: TransactionsToReviewListField
    value: JSON
    operands: [TransactionsToReviewListConditionInput!]
  }

  input TransactionsToReviewListInfoInput {
    page: Int
    pageSize: Int
    sort: [TransactionsToReviewListSortInput!]
    conditions: TransactionsToReviewListConditionInput
  }

  input GetTransactionsToReviewInput {
    listInfo: TransactionsToReviewListInfoInput
  }

  type TransactionToReviewListSortEntry {
    attribute: TransactionsToReviewListField!
    order: ListSortOrder!
  }

  type TransactionToReviewListInfo {
    page: Int!
    pageSize: Int!
    sort: [TransactionToReviewListSortEntry!]!
    conditions: JSON
  }

  type TransactionsToReviewListResponse {
    data: [TransactionToReview!]!
    listInfo: TransactionToReviewListInfo!
    pagination: ListPagination!
    meta: ListMeta!
  }

  input ApproveTransactionFieldValueInput {
    id: String
    value: String
    label: String
  }

  input ApproveTransactionPaymentSourceInput {
    kind: String!
    instrumentId: ID!
  }

  input ApproveTransactionChangesInput {
    name: String
    notes: String
    date: String
    cycle: String
    amount: Float
    category: ApproveTransactionFieldValueInput
    subCategory: ApproveTransactionFieldValueInput
    paymentMode: String
    paymentSource: ApproveTransactionPaymentSourceInput
    isCreditCardRepayment: Boolean
    isPrivate: Boolean
  }

  input ApproveTransactionInput {
    reviewId: ID!
    changes: ApproveTransactionChangesInput
  }

  type ApproveTransactionResponse {
    success: Boolean!
    transaction: Transaction
    review: TransactionToReview
    error: Error
  }

  input RejectTransactionInput {
    transactionId: ID!
    notes: String
  }

  type RejectTransactionResponse {
    success: Boolean!
    review: TransactionToReview
    error: Error
  }

  input EditTransactionInput {
    transactionId: ID!
    changes: ApproveTransactionChangesInput!
    deleteAttachments: [ID!]
  }

  type EditTransactionResponse {
    success: Boolean!
    transaction: Transaction
    error: Error
  }

  input DeleteTransactionInput {
    transactionId: ID!
  }

  type DeleteTransactionResponse {
    success: Boolean!
    error: Error
  }

  input CreateTransactionInput {
    amount: Float!
    type: String!
    date: String!
    name: String!
    merchant: String
    cycle: String
    category: ApproveTransactionFieldValueInput
    subCategory: ApproveTransactionFieldValueInput
    paymentMode: String!
    paymentSource: ApproveTransactionPaymentSourceInput!
    isCreditCardRepayment: Boolean
    isPrivate: Boolean
    notes: String
    currency: String
  }

  type CreateTransactionResponse {
    success: Boolean!
    transaction: Transaction
    error: Error
  }

  enum TransactionExportType {
    CSV
    XLSX
  }

  input ExportTransactionsInput {
    exportType: TransactionExportType!
    sort: [TransactionsListSortInput!]
    conditions: TransactionsListConditionInput!
  }

  type ExportTransactionsResponse {
    success: Boolean!
    fileName: String
    mimeType: String
    contentBase64: String
    rowCount: Int
    error: Error
  }

  type FieldMetaNestedTo {
    id: String!
  }

  type FieldMeta {
    id: String!
    name: String!
    label: String!
    isActive: Boolean!
    isCustom: Boolean!
    nestedTo: FieldMetaNestedTo
  }

  type FieldOption {
    id: String!
    value: String!
    label: String!
  }

  """
  Generic attachment infrastructure — shared across every entity that can
  hold attachments (reviews today; transactions, recurring payments,
  profiles, and workspaces later).
  """
  enum AttachmentEntityType {
    REVIEW
    TRANSACTION
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
    getDebitEmailsToProcess: GetDebitEmailsToProcessResponse!
    getDebitEmailsToProcessByStatus(
      input: GetDebitEmailsByStatusInput!
    ): GetDebitEmailsToProcessByStatusResponse!
    loginWithGoogle: String!
    getSheetsAuthUrl: String!
    getBankAccounts: [BankAccount!]!
    getBankAccount(id: ID!): BankAccount
    getCreditCards: [CreditCard!]!
    getCreditCard(id: ID!): CreditCard
    listCreditCards(input: CreditCardListRequestInput!): CreditCardListResponse!
    getTransactions(input: GetTransactionsInput!): TransactionsListResponse!
    getTransactionsToReview(input: GetTransactionsToReviewInput!): TransactionsToReviewListResponse!
    getTransactionWidgets(input: GetTransactionWidgetsInput!): TransactionWidgetsResponse!
    getFieldsMeta: [FieldMeta!]!
    getFieldOptions(fieldName: String!, parentId: String): [FieldOption!]!
    getAttachmentDownloadUrl(input: AttachmentDownloadUrlInput!): String!
  }

  type Mutation {
    syncEmails: SyncEmailsResult
    backfillEmails(input: BackfillEmailsInput!): SyncResult!
    processDebitEmails(input: ProcessDebitEmailsInput): ProcessDebitEmailsResult
    updateAppStatus(input: UpdateAppStatusInput!): AppStatus
    testMutation(input: String!): String
    logout: Boolean!
    onboardUser(input: OnboardUserInput!): OnboardUserResponse!
    updateUserPreferences(input: UpdateUserPreferencesInput!): UserPreferences!
    createBankAccount(input: CreateBankAccountInput!): BankAccountResponse!
    updateBankAccount(id: ID!, input: UpdateBankAccountInput!): BankAccountResponse
    deleteBankAccount(id: ID!): BankAccountResponse
    createCreditCard(input: CreateCreditCardInput!): CreditCardResponse!
    updateCreditCard(id: ID!, input: UpdateCreditCardInput!): CreditCardResponse!
    deleteCreditCard(id: ID!): CreditCardResponse!
    approveTransaction(input: ApproveTransactionInput!): ApproveTransactionResponse!
    rejectTransaction(input: RejectTransactionInput!): RejectTransactionResponse!
    createTransaction(input: CreateTransactionInput!): CreateTransactionResponse!
    editTransaction(input: EditTransactionInput!): EditTransactionResponse!
    deleteTransaction(input: DeleteTransactionInput!): DeleteTransactionResponse!
    exportTransactions(input: ExportTransactionsInput!): ExportTransactionsResponse!
    uploadAttachments(input: UploadAttachmentsInput!): UploadAttachmentsPayload!
    deleteAttachment(input: DeleteAttachmentInput!): Boolean!
  }
`;

module.exports = typeDefs;
