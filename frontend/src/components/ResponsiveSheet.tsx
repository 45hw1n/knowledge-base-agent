import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/lib/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/lib/ui/drawer";

// Same desktop/mobile split as lib/ui/modal.tsx (Dialog vs Drawer), but for
// a side panel instead of a centered modal: Sheet (slides in from the
// right) on desktop, Drawer (slides up from the bottom) on mobile.
interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  // Rendered as a sibling AFTER the scrollable content div, never inside
  // it — so it never scrolls away: pinned at the bottom on desktop, and
  // simply non-scrollable on mobile, on both sides of the same layout
  // trick (outside the overflow-y-auto container), not CSS `position:
  // sticky` (which can be flaky inside a scroll container).
  footer?: React.ReactNode;
}

export function ResponsiveSheet({ open, onOpenChange, title, description, children, contentClassName, footer }: ResponsiveSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={cn("flex w-full flex-col gap-0 sm:max-w-lg", contentClassName)}>
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="-mx-6 -mb-6 border-t bg-background px-6 py-4">{footer}</div>}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Fixed height, not max-h — a cap lets the drawer's actual height
          track its content, so switching tabs (short "No attachments" vs a
          long conversation thread) visibly resized the sheet. Fixed height
          keeps the sheet itself stable; the content area below scrolls
          internally instead. */}
      <DrawerContent className={cn("flex h-[85vh] flex-col", contentClassName)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
        {footer && <div className="border-t bg-background px-4 py-4">{footer}</div>}
      </DrawerContent>
    </Drawer>
  );
}
