import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/lib/ui/button";

const MAX_TEXTAREA_HEIGHT_PX = 200;

interface ChatComposerProps {
  onSend: (content: string) => void;
}

/**
 * Pinned below the message list as a sibling, never inside its
 * overflow-y-auto container — same "outside the scroll area" layout trick
 * already used for the entity detail sheet's footer (see
 * ResponsiveSheet.tsx), so the composer never scrolls out of view.
 */
export function ChatComposer({ onSend }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your invoices, tickets, or anything else Cortex has extracted..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
