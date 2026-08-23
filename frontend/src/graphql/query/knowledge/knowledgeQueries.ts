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
