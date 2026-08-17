import { useQuery } from '@apollo/client';
import { GET_FIELDS_META } from '@/graphql/queries/fields/GET_FIELDS_META';
import { FieldMeta } from './FieldDropdown.types';

export function useFieldsMeta() {
  const { data, loading, error } = useQuery<{ getFieldsMeta: FieldMeta[] }>(GET_FIELDS_META, {
    fetchPolicy: 'cache-first',
  });
  return { fieldsMeta: data?.getFieldsMeta ?? [], loading, error };
}
