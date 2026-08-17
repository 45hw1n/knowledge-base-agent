import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/lib/ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  disabled,
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type="button"
    aria-label="Go to previous page"
    disabled={disabled}
    className={cn(
      buttonVariants({ variant: "outline", size: "icon" }),
      "h-9 min-w-9",
      className
    )}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
  </button>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  disabled,
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type="button"
    aria-label="Go to next page"
    disabled={disabled}
    className={cn(
      buttonVariants({ variant: "outline", size: "icon" }),
      "h-9 min-w-9",
      className
    )}
    {...props}
  >
    <ChevronRight className="h-4 w-4" />
  </button>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

function getPaginationItems(
  currentPage: number,
  totalPages: number
): (number | "ellipsis")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>()
  pages.add(currentPage)
  pages.add(currentPage - 1)
  pages.add(currentPage + 1)

  if (currentPage <= 3) {
    pages.add(1)
    pages.add(2)
    pages.add(3)
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 2)
    pages.add(totalPages - 1)
    pages.add(totalPages)
  }

  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)

  const items: (number | "ellipsis")[] = []

  if (sorted[0] > 1) {
    items.push("ellipsis")
  }

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      items.push("ellipsis")
    }
    items.push(sorted[i])
  }

  if (sorted[sorted.length - 1] < totalPages) {
    items.push("ellipsis")
  }

  return items
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  getPaginationItems,
}
