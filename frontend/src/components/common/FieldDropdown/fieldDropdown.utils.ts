import { FieldMeta } from './FieldDropdown.types';

export function getDescendants(fieldId: string, allMeta: FieldMeta[]): string[] {
  const directChildren = allMeta.filter(f => f.nestedTo?.id === fieldId);
  return directChildren.flatMap(child => [child.name, ...getDescendants(child.id, allMeta)]);
}
