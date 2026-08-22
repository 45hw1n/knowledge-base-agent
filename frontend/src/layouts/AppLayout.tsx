import { Outlet, useLocation } from "react-router-dom";
import { AppSettings } from "@/components/AppSettings";
import { AppSidebar } from "@/components/app-sidebar";
import { LastSyncedAt } from "@/components/LastSyncedAt";
import { PageShell } from "@/components/page-layout";
import { PageHeaderTitle } from "@/components/page-header-title";
import {
  SidebarCollapseTrigger,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/lib/ui/sidebar";

const CONVERSATIONS_PATH_PREFIX = "/conversations";

export default function AppLayout() {
  const { pathname } = useLocation();
  // The chat UI needs the full width/height a Claude-Desktop-style layout
  // expects (its own history sidebar + message list + composer) — the nav
  // sidebar stays locked to its icon rail rather than competing for space,
  // and the normal padded/max-width page wrapper is skipped so the route
  // can lay out its own three-pane content edge to edge.
  const isConversationsRoute = pathname.startsWith(CONVERSATIONS_PATH_PREFIX);

  return (
    <SidebarProvider
      open={isConversationsRoute ? false : undefined}
      onOpenChange={isConversationsRoute ? () => {} : undefined}
    >
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-muted/30">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
          <SidebarTrigger className="md:hidden" />
          {!isConversationsRoute && <SidebarCollapseTrigger className="hidden md:flex" />}
          <div className="h-4 w-px bg-border" />
          <PageHeaderTitle />
          <div className="ml-auto flex items-center gap-4">
            {/* Mobile gets this in the side drawer instead — see AppSidebar. */}
            <div className="hidden md:block">
              <LastSyncedAt />
            </div>
            <AppSettings />
          </div>
        </header>
        {isConversationsRoute ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col p-4 md:p-6">
            <div
              className="mx-auto flex min-h-0 w-full min-w-0 max-w-7xl flex-1 flex-col"
              id="app-content"
            >
              <PageShell>
                <Outlet />
              </PageShell>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
