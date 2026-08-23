import { gql } from "@apollo/client";

// Mutation field is "createKnowledbase" (kept literally per naming
// instruction) — the constant name here follows this app's existing
// convention of not needing to match the schema field name exactly (see
// GET_ENTITY_DETAIL / entityDetail).
export const CREATE_KNOWLEDGE_BASE = gql`
  mutation CreateKnowledgebase($input: CreateKnowledgebaseInput!) {
    createKnowledbase(input: $input) {
      creationId
      status
    }
  }
`;

// Schema field is "manualIngestionStatus" — named GET_COMPLETED_ATTACHMENTS
// on the frontend per instruction, same "constant name != schema field
// name" convention as above.
export const GET_COMPLETED_ATTACHMENTS = gql`
  query GetCompletedAttachments($creationIds: [ID!]!) {
    manualIngestionStatus(creationIds: $creationIds) {
      creationId
      status
      entityId
      entityType
      displayId
      title
      error {
        code
        message
      }
    }
  }
`;

// Backs the standalone "manual entries" review page — every one of the
// user's IN_PROGRESS/FAILED manual "Create Knowledge" submissions.
export const GET_MANUAL_INGESTION_FAILURES = gql`
  query GetManualIngestionFailures {
    manualIngestionFailures {
      id
      type
      details
      summary
      status
      error {
        code
        message
      }
      attachments {
        fileName
        mimeType
        size
      }
      createdAt
    }
  }
`;

export const DELETE_MANUAL_INGESTION_ITEM = gql`
  mutation DeleteManualIngestionItem($id: ID!) {
    deleteManualIngestionItem(id: $id)
  }
`;

export const RETRY_MANUAL_INGESTION = gql`
  mutation RetryManualIngestion($id: ID!, $input: CreateKnowledgebaseInput!) {
    retryManualIngestion(id: $id, input: $input) {
      creationId
      status
    }
  }
`;
