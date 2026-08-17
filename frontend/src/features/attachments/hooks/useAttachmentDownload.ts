import { useCallback } from "react";
import { useLazyQuery } from "@apollo/client";
import { toast } from "sonner";
import { GET_ATTACHMENT_DOWNLOAD_URL } from "../api";
import { AttachmentEntityType } from "../types";

interface AttachmentDownloadInput {
  entityType: AttachmentEntityType;
  entityId: string;
  attachmentId: string;
}

export function useAttachmentDownload() {
  const [fetchDownloadUrl] = useLazyQuery(GET_ATTACHMENT_DOWNLOAD_URL, {
    fetchPolicy: "network-only",
  });

  const getDownloadUrl = useCallback(
    async ({
      entityType,
      entityId,
      attachmentId,
    }: AttachmentDownloadInput): Promise<string> => {
      const { data } = await fetchDownloadUrl({
        variables: { input: { entityType, entityId, attachmentId } },
      });
      const url = data?.getAttachmentDownloadUrl;

      if (!url) {
        throw new Error("Could not get an attachment download link");
      }

      return url;
    },
    [fetchDownloadUrl],
  );

  const downloadAttachment = useCallback(
    async (input: AttachmentDownloadInput, fileName: string) => {
      try {
        const url = await getDownloadUrl(input);

        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Attachment download failed");
          }

          const blobUrl = URL.createObjectURL(await response.blob());
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
        } catch {
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          link.remove();
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to download attachment",
        );
      }
    },
    [getDownloadUrl],
  );

  return { getDownloadUrl, downloadAttachment };
}
