import { cn } from "@/lib/utils";

/** Default page container: fills available space and contains overflow. Used by AppLayout. */
export function PageShell({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 min-w-0 flex-1 w-full overflow-x-hidden overflow-y-auto mb-[80px]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Optional vertical stack layout for page sections. */
export function PageContent({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      {children}
    </div>
  );
}
