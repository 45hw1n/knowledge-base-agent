import { gql } from '@apollo/client';

export const GET_FIELD_OPTIONS = gql`
  query GetFieldOptions($fieldName: String!, $parentId: String) {
    getFieldOptions(fieldName: $fieldName, parentId: $parentId) {
      id
      value
      label
    }
  }
`;
