import { gql } from "@apollo/client";

export const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($input: UpdateUserPreferencesInput!) {
    updateUserPreferences(input: $input) {
      id
      autoProcess
      isBetaUser
    }
  }
`;
