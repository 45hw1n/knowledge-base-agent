import { gql } from "@apollo/client";

export const UPLOAD_ATTACHMENTS = gql`
  mutation UploadAttachments($input: UploadAttachmentsInput!) {
    uploadAttachments(input: $input) {
      entityType
      entityId
      status
      files {
        attachmentId
        fileName
        status
        errorCode
      }
      attachments {
        id
        fileName
        mimeType
        size
        uploadedAt
      }
    }
  }
`;

export const DELETE_ATTACHMENT = gql`
  mutation DeleteAttachment($input: DeleteAttachmentInput!) {
    deleteAttachment(input: $input)
  }
`;

export const GET_ATTACHMENT_DOWNLOAD_URL = gql`
  query GetAttachmentDownloadUrl($input: AttachmentDownloadUrlInput!) {
    getAttachmentDownloadUrl(input: $input)
  }
`;
