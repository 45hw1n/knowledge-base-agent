import { Input } from "@/lib/ui/input";

interface GoogleSheetIdInputProps {
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
  placeholder: null | string
}

export function GoogleSheetIdInput({
  value,
  isDisabled,
  onChange,
  placeholder = null
}: GoogleSheetIdInputProps) {
  return (
    <Input
      id="google-sheet-id"
      value={value}
      disabled={isDisabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder || "Enter your Google Sheet ID"}
    />
  );
}
