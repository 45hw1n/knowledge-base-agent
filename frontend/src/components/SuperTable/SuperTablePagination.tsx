import React from "react";
import { ListInfo } from "../../store/useTableStore";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  getPaginationItems,
} from "@/lib/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/lib/ui/select";

export interface SuperTablePaginationProps {
  listInfo: ListInfo;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  isLoading: boolean;
}

export function SuperTablePagination({
  listInfo,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: SuperTablePaginationProps) {
  const { page, pageSize, total } = listInfo;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isPreviousDisabled = page <= 1 || isLoading;
  const isNextDisabled = page >= totalPages || isLoading;

  if (total === 0) return null;

  return (
    <div className="flex flex-col items-start gap-4 px-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm text-muted-foreground lg:flex-1">
        {totalPages > 1
          ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total} entries`
          : `Showing ${total} ${total === 1 ? "entry" : "entries"}`}
      </div>
      {totalPages > 1 && (
        <div className="flex w-full flex-row flex-wrap items-center justify-start gap-4 lg:w-auto lg:gap-6 xl:gap-8">
          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => onPageSizeChange(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="text-sm font-medium lg:flex lg:w-[100px] lg:items-center lg:justify-center">
            Page {page} of {totalPages}
          </div>
          <Pagination className="mx-0 ml-0 mr-auto w-auto justify-start">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={isPreviousDisabled}
                  onClick={() => onPageChange(page - 1)}
                />
              </PaginationItem>
              {getPaginationItems(page, totalPages).map((item, index) => (
                <PaginationItem
                  key={item === "ellipsis" ? `ellipsis-${index}` : item}
                >
                  {item === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={item === page}
                      className="h-9 min-w-9"
                      aria-disabled={isLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!isLoading && item !== page) {
                          onPageChange(item);
                        }
                      }}
                    >
                      {item}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  disabled={isNextDisabled}
                  onClick={() => onPageChange(page + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
