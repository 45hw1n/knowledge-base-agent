import { gql } from '@apollo/client';

export const GET_SHEETS_AUTH_URL = gql`
  query GetSheetsAuthUrl {
    getSheetsAuthUrl
  }
`;
