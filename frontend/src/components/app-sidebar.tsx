import { useMutation } from "@apollo/client";
import { Home, LogOut, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import CortexLogo from "@/assets/cortex-logo.svg";
import { LastSyncedAt } from "@/components/LastSyncedAt";
import { LOGOUT } from "@/graphql/query/auth/authQueries";
import { useIsMobile } from "@/hooks/use-mobile";
import { apolloClient } from "@/lib/apollo";
import {
  Sidebar,
  SidebarCollapseTrigger,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/lib/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { useTableStore } from "@/store/useTableStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";

type SidebarNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: SidebarNavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Ask Cortex", href: "/ask-cortex", icon: MessageCircle },
];

const navLabelClassName =
  "truncate transition-[opacity,width] duration-200 ease-linear group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0";

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function clearAppState() {
  useAppStore.setState({ user: null, appStatus: null, initialized: false });
  useUserPreferencesStore.setState({ userPreferences: null });
  useTableStore.setState({ tables: {} });
}

function clearCookies() {
  document.cookie.split(";").forEach((cookiePart) => {
    document.cookie = cookiePart
      .replace(/^ +/, "")
      .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
  });
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();

  const [logout, { loading }] = useMutation(LOGOUT, {
    onCompleted: async () => {
      clearAppState();
      await apolloClient.clearStore();
      clearCookies();
      window.location.href = "/login";
    },
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80">
      <SidebarHeader className="flex h-14 flex-row items-center gap-2 border-b border-sidebar-border/70 px-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link
          to="/home"
          className={cn(
            "flex min-w-0 flex-1 items-center overflow-hidden px-2 transition-[opacity,width] duration-200 ease-linear",
            "group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          )}
        >
          <img
            src={CortexLogo}
            alt="Cortex"
            className={cn(
              "h-6 w-auto shrink-0 transition-all duration-200 ease-linear",
              "group-data-[collapsible=icon]:hidden"
            )}
          />
          <span
            aria-hidden
            className={cn(
              "hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#906FFF] to-[#2A03A9] text-sm font-semibold text-white",
              "group-data-[collapsible=icon]:flex"
            )}
          >
            C
          </span>
        </Link>
        {/* <SidebarCollapseTrigger className="hidden md:flex" /> */}
      </SidebarHeader>

      <SidebarContent className="bg-sidebar/70">
        <SidebarGroup className="px-2 py-3 group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isItemActive(pathname, item.href)}
                      tooltip={item.label}
                    >
                      <Link to={item.href}>
                        <Icon />
                        <span className={navLabelClassName}>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2 group-data-[collapsible=icon]:px-0">
        {/* Desktop gets this in the top header instead — see AppLayout. */}
        {isMobile && (
          <div className="px-2 pb-2">
            <LastSyncedAt />
          </div>
        )}
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              disabled={loading}
              onClick={() => logout()}
            >
              <LogOut />
              <span className={navLabelClassName}>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
