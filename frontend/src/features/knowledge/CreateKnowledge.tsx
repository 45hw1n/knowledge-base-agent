import { useState } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Modal } from "@/lib/ui/modal";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/lib/ui/card";
import { Button } from "@/lib/ui/button";
import { Label } from "@/lib/ui/label";
import { Textarea } from "@/lib/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/lib/ui/select";
import { AttachmentUploaderButton } from "@/components/AttachmentGroup/AttachmentUploaderButton";
import { useLocalAttachmentSelection } from "@/features/attachments/hooks/useLocalAttachmentSelection";
import { formatAttachmentFileSize } from "@/features/attachments/utils";
import { CREATE_KNOWLEDGE_BASE } from "@/graphql/query/knowledge/knowledgeQueries";
import { usePendingCreationsStore } from "@/store/pendingCreationsStore";
import type { EntityType } from "@/mocks/entities.types";

const TYPE_OPTIONS: EntityType[] = ["TICKET", "INVOICE", "PAYMENT", "EVENT", "DOCUMENT"];
const MAX_ATTACHMENTS = 5;

interface CreateKnowledgeResponse {
  createKnowledbase: { creationId: string; status: string };
}

interface CreateKnowledgeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateKnowledge({ open, onOpenChange }: CreateKnowledgeProps) {
  const [type, setType] = useState<EntityType | "">("");
  const [details, setDetails] = useState("");
  const { items, files, addFiles, remove, reset } = useLocalAttachmentSelection(MAX_ATTACHMENTS);
  const addPending = usePendingCreationsStore((s) => s.addPending);

  const [createKnowledgebase, { loading }] = useMutation<CreateKnowledgeResponse>(CREATE_KNOWLEDGE_BASE);

  const resetForm = () => {
    setType("");
    setDetails("");
    reset();
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!type || !details.trim()) return;

    try {
      const { data } = await createKnowledgebase({
        variables: { input: { type, details: details.trim(), attachments: files } },
      });
      const creationId = data?.createKnowledbase.creationId;
      if (!creationId) throw new Error("No creationId returned");

      // Close immediately and never wait on AI processing — the polling
      // hook picks this id up from pendingCreationsStore/sessionStorage.
      resetForm();
      onOpenChange(false);
      addPending(creationId);
      toast("Creation in progress");
    } catch (error) {
      console.error("[CreateKnowledge] Failed to submit:", error);
      toast.error("Failed to start creation. Please try again.");
    }
  };

  return (
    <Modal open={open} onOpenChange={(next) => !next && handleClose()}>
      <Card className="w-full max-w-lg border-none shadow-none">
        <CardHeader>
          <CardTitle>Create Knowledge</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="knowledge-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as EntityType)}>
              <SelectTrigger id="knowledge-type">
                <SelectValue placeholder="Select a type..." />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="knowledge-details">Details</Label>
            <Textarea
              id="knowledge-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the information you want to add to the knowledge base..."
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <AttachmentUploaderButton onFilesSelected={addFiles} disabled={items.length >= MAX_ATTACHMENTS} />
            </div>
            {items.length > 0 && (
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li
                    key={item.localId}
                    className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <span className="truncate">{item.fileName}</span>
                    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      {formatAttachmentFileSize(item.size)}
                      <button
                        type="button"
                        onClick={() => remove(item.localId)}
                        className="hover:text-foreground"
                        aria-label={`Remove ${item.fileName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !type || !details.trim()}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </CardFooter>
      </Card>
    </Modal>
  );
}
