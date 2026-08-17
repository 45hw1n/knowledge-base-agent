import { gql } from '@apollo/client';

export const GET_FIELDS_META = gql`
  query GetFieldsMeta {
    getFieldsMeta {
      id
      name
      label
      isActive
      isCustom
      nestedTo {
        id
      }
    }
  }
`;
