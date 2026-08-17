import { Fragment } from "react";
import { usePageBreadcrumb } from "@/hooks/use-page-breadcrumb";
import { cn } from "@/lib/utils";

export function PageHeaderTitle() {
  const crumbs = usePageBreadcrumb();

  if (crumbs.length === 0) {
    return null;
  }

  if (crumbs.length === 1) {
    return (
      <p className="text-sm font-medium text-foreground opacity-100">{crumbs[0].title}</p>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
      {crumbs.map((crumb, index) => {
        const isActive = index === crumbs.length - 1;

        return (
          <Fragment key={crumb.pathname}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground/50">
                &gt;
              </span>
            ) : null}
            <span
              className={cn(
                "truncate font-medium",
                isActive
                  ? "text-foreground opacity-100"
                  : "text-muted-foreground opacity-50"
              )}
            >
              {crumb.title}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
