import { gql } from "@apollo/client";

export const SYNC_EMAILS = gql`
  mutation SyncEmails {
    syncEmails {
      success
      message
      processedCount
    }
  }
`;

export const GET_EMAILS_TO_PROCESS_BY_STATUS = gql`
  query GetEmailsToProcessByStatus($input: GetEmailsByStatusInput!) {
    getEmailsToProcessByStatus(input: $input) {
      count
      data {
        status
        ids
      }
    }
  }
`;

export const PROCESS_EMAILS = gql`
  mutation ProcessEmails($input: ProcessEmailsInput) {
    processEmails(input: $input) {
      success
      message
      queuedCount
    }
  }
`;

export const GET_SYNC_STATUS = gql`
  query GetSyncStatus {
    getAppStatus {
      emailSyncStatus
      emailProcessingInProgress
      emailLastSyncedAt
      lastEmailAIProcessedCount
    }
  }
`;
