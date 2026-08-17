import { useQuery } from '@apollo/client';
import { GET_FIELD_OPTIONS } from '@/graphql/queries/fields/GET_FIELD_OPTIONS';
import { FieldOption } from './FieldDropdown.types';

interface UseFieldOptionsArgs {
  fieldName: string;
  parentId?: string | null;
  skip?: boolean;
}

export function useFieldOptions({ fieldName, parentId, skip }: UseFieldOptionsArgs) {
  const { data, loading, error } = useQuery<{ getFieldOptions: FieldOption[] }>(GET_FIELD_OPTIONS, {
    variables: { fieldName, parentId: parentId ?? null },
    fetchPolicy: 'cache-first',
    skip: skip ?? false,
  });
  return { options: data?.getFieldOptions ?? [], loading, error };
}
