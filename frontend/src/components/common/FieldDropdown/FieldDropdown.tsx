import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/ui/select';
import { FieldDropdownProps, DropdownValue } from './FieldDropdown.types';
import { useFieldsMeta } from './useFieldsMeta';
import { useFieldOptions } from './useFieldOptions';
import { getDescendants } from './fieldDropdown.utils';

export function FieldDropdown({
  fieldName,
  value,
  parentValue,
  disabled,
  placeholder,
  triggerClassName,
  onChange,
}: FieldDropdownProps) {
  const { fieldsMeta, loading: metaLoading } = useFieldsMeta();

  const thisMeta = fieldsMeta.find(f => f.name === fieldName) ?? null;
  const isNested = thisMeta != null && thisMeta.nestedTo != null;
  const hasParent = isNested && parentValue != null;

  // Skip fetching options when meta isn't ready or nested field has no parent selected
  const skipFetch = metaLoading || (isNested && !hasParent);

  const { options, loading: optionsLoading } = useFieldOptions({
    fieldName,
    parentId: hasParent ? parentValue.id : null,
    skip: skipFetch,
  });

  const parentMeta = isNested && thisMeta?.nestedTo
    ? fieldsMeta.find(f => f.id === thisMeta.nestedTo!.id) ?? null
    : null;

  const isDisabled = disabled || metaLoading || (isNested && !hasParent);
  const isLoading = !skipFetch && optionsLoading;

  const effectivePlaceholder = (() => {
    if (isNested && !hasParent && !metaLoading) return `Select ${parentMeta?.label ?? '...'}`;
    if (isLoading) return 'Loading…';
    return placeholder ?? 'Select…';
  })();

  function handleChange(selectedId: string) {
    const selected = options.find(o => o.id === selectedId) ?? null;
    const resetChildren = thisMeta ? getDescendants(thisMeta.id, fieldsMeta) : [];
    onChange?.({
      field: fieldName,
      value: selected as DropdownValue,
      resetChildren: resetChildren.length > 0 ? resetChildren : undefined,
    });
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    const resetChildren = thisMeta ? getDescendants(thisMeta.id, fieldsMeta) : [];
    onChange?.({
      field: fieldName,
      value: null,
      resetChildren: resetChildren.length > 0 ? resetChildren : undefined,
    });
  }

  const showClear = value != null && !isDisabled && !isLoading;

  return (
    <div>
      {thisMeta?.label && (
        <p className="text-sm text-muted-foreground mb-2">{thisMeta.label}</p>
      )}
    <Select
      value={value?.id ?? ''}
      onValueChange={handleChange}
      disabled={isDisabled || isLoading}
    >
      <SelectTrigger className={triggerClassName}>
        <div className="flex items-center flex-1 min-w-0 mr-[5px]">
          <SelectValue placeholder={effectivePlaceholder} />
          {showClear && (
            <span
              role="button"
              aria-label="Clear selection"
              className="ml-auto pl-1 rounded-sm opacity-50 hover:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
              onPointerDown={e => e.stopPropagation()}
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <SelectItem value="__empty__" disabled>
            No options available
          </SelectItem>
        ) : (
          options.map(opt => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
    </div>
  );
}
