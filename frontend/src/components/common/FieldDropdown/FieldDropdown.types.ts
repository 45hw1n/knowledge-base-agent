export type DropdownValue = {
  id: string;
  value: string;
  label: string;
} | null;

export type ParentValue = {
  id: string;
  value: string;
  label: string;
} | null;

export interface FieldMeta {
  id: string;
  name: string;
  label: string;
  isActive: boolean;
  isCustom: boolean;
  nestedTo: { id: string } | null;
}

export interface FieldOption {
  id: string;
  value: string;
  label: string;
}

export interface FieldDropdownProps {
  fieldName: string;
  value?: DropdownValue;
  parentValue?: ParentValue;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  triggerClassName?: string;
  onChange?: (payload: {
    field: string;
    value: DropdownValue;
    resetChildren?: string[];
  }) => void;
}
