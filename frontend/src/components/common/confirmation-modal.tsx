import { useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/lib/ui/card";
import { Button } from "@/lib/ui/button";

type ConfirmationModalProps = {
  open: boolean;
  title: string; // header text
  message: string; // body content
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function ConfirmationModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
    } catch (error) {
      console.error("Confirmation error:", error);
      // We keep the modal open on error as per requirements
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(val) => !val && onCancel()}>
      <Card className="border-none shadow-none">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>

          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? "Processing..." : "Confirm"}
          </Button>
        </CardFooter>
      </Card>
    </Modal>
  );
}
