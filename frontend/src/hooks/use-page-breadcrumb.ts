import { useLocation } from "react-router-dom";
import { getPageBreadcrumbs, type PageBreadcrumb } from "@/router/page-routes";

export type { PageBreadcrumb };

export function usePageBreadcrumb(): PageBreadcrumb[] {
  const { pathname } = useLocation();
  return getPageBreadcrumbs(pathname);
}
