import { Outlet } from "react-router-dom";
import { AppSettings } from "@/components/AppSettings";
import { AppSidebar } from "@/components/app-sidebar";
import { PageShell } from "@/components/page-layout";
import { PageHeaderTitle } from "@/components/page-header-title";
import {
  SidebarCollapseTrigger,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/lib/ui/sidebar";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-muted/30">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
          <SidebarTrigger className="md:hidden" />
          <SidebarCollapseTrigger className="hidden md:flex" />
          <div className="h-4 w-px bg-border" />
          <PageHeaderTitle />
          <div className="ml-auto">
            <AppSettings />
          </div>
        </header>
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
      </SidebarInset>
    </SidebarProvider>
  );
}
