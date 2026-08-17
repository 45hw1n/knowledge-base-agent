import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AttachmentItem } from "../types";
import { validateAttachmentFiles } from "../utils";

export function useLocalAttachmentSelection(maxAttachments: number) {
  const [items, setItems] = useState<AttachmentItem[]>([]);

  const addFiles = useCallback(
    (files: File[]) => {
      const { validFiles, errors } = validateAttachmentFiles(files, {
        remainingSlots: Math.max(maxAttachments - items.length, 0),
      });
      errors.forEach((message) => toast.error(message));

      if (validFiles.length === 0) return;
      setItems((current) => [
        ...current,
        ...validFiles.map((file) => ({
          localId: `local-${crypto.randomUUID()}`,
          attachmentId: null,
          file,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          status: "SUCCESS" as const,
          errorCode: null,
        })),
      ]);
    },
    [items.length, maxAttachments],
  );

  const remove = useCallback((localId: string) => {
    setItems((current) => current.filter((item) => item.localId !== localId));
  }, []);

  const reset = useCallback(() => {
    setItems([]);
  }, []);

  const files = useMemo(
    () => items.flatMap((item) => (item.file ? [item.file] : [])),
    [items],
  );

  return { items, files, addFiles, remove, reset };
}
