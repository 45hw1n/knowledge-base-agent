import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { ALLOWED_ATTACHMENT_FILE_PICKER_ACCEPT } from "@/features/attachments/constants";

export interface AttachmentUploaderButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Pure presentational trigger for the native file picker. Selection
 * handling/upload logic lives entirely in useAttachmentUploader — this
 * component just forwards the picked files.
 */
export function AttachmentUploaderButton({
  onFilesSelected,
  disabled = false,
  className,
}: AttachmentUploaderButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        className={className ?? "text-muted-foreground hover:text-foreground"}
        onClick={() => inputRef.current?.click()}
        aria-label="Add attachment"
      >
        <Paperclip className="w-4 h-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_ATTACHMENT_FILE_PICKER_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) onFilesSelected(files);
        }}
      />
    </>
  );
}
