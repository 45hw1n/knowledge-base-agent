import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { CreateKnowledge } from "./CreateKnowledge";

// Global header entry point (mounted in AppLayout.tsx) — a cross-cutting
// action (create any of the 5 entity types), not scoped to any one page.
export function CreateKnowledgeTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="icon" aria-label="Create knowledge" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
      </Button>
      <CreateKnowledge open={open} onOpenChange={setOpen} />
    </>
  );
}
