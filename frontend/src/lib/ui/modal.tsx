import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/lib/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/lib/ui/drawer"

interface ModalProps {
  activator?: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  contentClassName?: string
}

export function Modal({
  activator,
  open,
  onOpenChange,
  children,
  contentClassName,
}: ModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {activator && (
          <DialogTrigger asChild>
            {activator}
          </DialogTrigger>
        )}
        <DialogContent className={cn("p-0 border-none shadow-none [&>button]:hidden", contentClassName)}>
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {activator && (
        <DrawerTrigger asChild>
          {activator}
        </DrawerTrigger>
      )}
      <DrawerContent className={cn("p-0", contentClassName)}>
        {children}
      </DrawerContent>
    </Drawer>
  )
}
