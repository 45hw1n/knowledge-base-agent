import { gql } from "@apollo/client";

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const GET_CURRENT_USER = gql`
  query CurrentUser {
    currentUser {
      id
      displayName
      email
      grantedScopes {
        PROFILE
        EMAIL
        OPENID
        GMAIL_READONLY
      }
      gmailAuthRevoked
    }
  }
`;

export const GET_APP_STATUS = gql`
  query GetAppStatus {
    getAppStatus {
      userId
      onboarded
      emailLastSyncedAt
      emailSyncStatus
    }
  }
`;

export const GET_USER_PREFERENCES = gql`
  query GetUserPreferences {
    getUserPreferences {
      id
      userId
      emailSyncStartDate
      createdAt
      updatedAt
      autoProcess
      isBetaUser
    }
  }
`;
