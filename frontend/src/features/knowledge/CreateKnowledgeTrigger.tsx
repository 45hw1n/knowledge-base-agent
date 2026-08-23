import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/lib/ui/button";
import { CreateKnowledge } from "./CreateKnowledge";

// Home page entry point — a cross-cutting action (create any of the 5
// entity types), rendered next to the Knowledge table heading.
export function CreateKnowledgeTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Create Entity
      </Button>
      <CreateKnowledge open={open} onOpenChange={setOpen} />
    </>
  );
}
