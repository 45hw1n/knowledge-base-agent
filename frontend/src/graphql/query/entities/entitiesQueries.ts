import { gql } from "@apollo/client";

export const GET_ENTITIES = gql`
  query GetEntities($input: EntityListRequestInput) {
    entities(input: $input) {
      data {
        id
        userId
        type
        displayId
        title
        source {
          type
          provider
          url
          emailId
          threadId
        }
        entityId
        extraction {
          status
          model
          confidence
          extractedAt
        }
        createdAt
        updatedAt
      }
      listInfo {
        page
        pageSize
      }
      pagination {
        total
        totalPages
        hasNext
        hasPrevious
      }
    }
  }
`;

const PERSON_FIELDS = `name email`;
const CONVERSATION_FIELDS = `
  messageId
  direction
  content
  timestamp
  attachments {
    attachmentId
    fileName
  }
`;

export const GET_ENTITY_DETAIL = gql`
  query GetEntityDetail($id: ID!) {
    entityDetail(id: $id) {
      __typename
      ... on Invoice {
        id
        invoiceNumber
        amount { value currency }
        dueDate
        issuer { ${PERSON_FIELDS} }
        status
        conversation { ${CONVERSATION_FIELDS} }
        sourceUrl
        sourceType
        threadId
        messageId
        metadata
        createdAt
        updatedAt
        linkedPayments {
          id
          amount { value currency }
          paidAt
          linkMethod
        }
      }
      ... on Payment {
        id
        amount { value currency }
        paidAt
        payer { ${PERSON_FIELDS} }
        payee { ${PERSON_FIELDS} }
        invoiceId
        linkMethod
        sourceUrl
        sourceType
        threadId
        messageId
        metadata
        createdAt
        updatedAt
        invoice {
          id
          invoiceNumber
          amount { value currency }
          status
          issuer { ${PERSON_FIELDS} }
        }
      }
      ... on Ticket {
        id
        ticketNumber
        title
        summary
        ticketStatus: status
        urgency
        priority
        dueDate
        assignee { ${PERSON_FIELDS} }
        requester { ${PERSON_FIELDS} }
        conversation { ${CONVERSATION_FIELDS} }
        parentTicketId
        duplicateOfTicketId
        sourceUrl
        sourceType
        threadId
        messageId
        metadata
        createdAt
        updatedAt
        parentTicket { id title }
        duplicateOfTicket { id title }
      }
      ... on Event {
        id
        title
        description
        startTime
        endTime
        timezone
        location
        url
        attendees { ${PERSON_FIELDS} }
        organizer { ${PERSON_FIELDS} }
        attachments {
          documentId
          filename
          document { id title }
        }
        sourceUrl
        sourceType
        threadId
        messageId
        metadata
        createdAt
        updatedAt
      }
      ... on Document {
        id
        type
        title
        description
        documentSummary: summary
        documentNumber
        issuer { ${PERSON_FIELDS} }
        parties { name role }
        effectiveDate
        expiryDate
        documentAttachments: attachments { attachmentId fileName }
        sourceUrl
        sourceType
        threadId
        messageId
        metadata
        createdAt
        updatedAt
      }
    }
  }
`;
