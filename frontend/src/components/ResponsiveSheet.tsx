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
}

export function ResponsiveSheet({ open, onOpenChange, title, description, children, contentClassName }: ResponsiveSheetProps) {
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
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn("flex max-h-[85vh] flex-col", contentClassName)}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
