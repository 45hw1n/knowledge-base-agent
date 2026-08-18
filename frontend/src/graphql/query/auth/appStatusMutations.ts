import { gql } from "@apollo/client";

export const UPDATE_APP_STATUS = gql`
  mutation UpdateAppStatus($input: UpdateAppStatusInput!) {
    updateAppStatus(input: $input) {
      userId
      onboarded
      emailLastSyncedAt
    }
  }
`;
