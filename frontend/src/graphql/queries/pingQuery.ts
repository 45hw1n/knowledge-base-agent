import { gql } from "@apollo/client";

export const PING_QUERY = gql`
  query Ping {
    ping
  }
`;
