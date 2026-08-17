export type AttachmentEntityType =
  | "REVIEW"
  | "TRANSACTION"
  | "RECURRING_PAYMENT"
  | "PROFILE"
  | "WORKSPACE";

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export type AttachmentErrorCode =
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "UPLOAD_FAILED"
  | "ATTACHMENT_LIMIT_EXCEEDED";

export interface AttachmentFileResult {
  attachmentId: string;
  fileName: string;
  status: "SUCCESS" | "FAILED";
  errorCode?: AttachmentErrorCode | null;
}

export interface UploadAttachmentsPayload {
  entityType: AttachmentEntityType;
  entityId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILURE";
  files: AttachmentFileResult[];
  attachments: Attachment[];
}

export type AttachmentItemStatus = "UPLOADING" | "SUCCESS" | "FAILED";

/**
 * The single source of truth for one attachment slot in the UI, whether it
 * was already persisted (loaded from the entity) or was just added in this
 * session. `file` is only ever populated while a retry might be needed
 * (UPLOADING/FAILED) — once an upload is confirmed SUCCESS the browser File
 * is no longer needed and is cleared.
 */
export interface AttachmentItem {
  localId: string;
  attachmentId: string | null;
  file: File | null;
  fileName: string;
  mimeType: string;
  size: number;
  status: AttachmentItemStatus;
  errorCode?: AttachmentErrorCode | null;
}
