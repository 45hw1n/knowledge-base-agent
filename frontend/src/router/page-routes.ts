export type PageRouteNode = {
  segment: string;
  title: string;
  children?: PageRouteNode[];
};

/** App pages under AppLayout — add nested entries to `children` for sub-pages. */
export const PAGE_ROUTE_TREE: PageRouteNode[] = [
  { segment: "home", title: "Home" },
  { segment: "review", title: "Review Queue" },
  { segment: "settings", title: "Settings" },
];

export type PageBreadcrumb = {
  title: string;
  pathname: string;
};

export function getPageBreadcrumbs(pathname: string): PageBreadcrumb[] {
  const segments = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: PageBreadcrumb[] = [];
  let nodes = PAGE_ROUTE_TREE;
  let currentPath = "";

  for (const segment of segments) {
    const node = nodes.find((entry) => entry.segment === segment);
    if (!node) break;

    currentPath += `/${segment}`;
    crumbs.push({ title: node.title, pathname: currentPath });
    nodes = node.children ?? [];
  }

  return crumbs;
}
