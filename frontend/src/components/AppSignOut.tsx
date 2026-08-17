import { useMutation } from "@apollo/client";
import { LogOut } from "lucide-react";
import { LOGOUT } from "@/graphql/query/auth/authQueries";
import { apolloClient } from "@/lib/apollo";
import { Button } from "@/lib/ui/button";
import { useAppStore } from "@/store/appStore";
import { useTableStore } from "@/store/useTableStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";

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

export function AppSignOut() {
  const [logout, { loading }] = useMutation(LOGOUT, {
    onCompleted: async () => {
      clearAppState();
      await apolloClient.clearStore();
      clearCookies();
      window.location.href = "/login";
    },
  });

  return (
    <Button
      variant="ghost"
      className="h-9 w-full justify-start gap-2 px-2"
      disabled={loading}
      onClick={() => logout()}
    >
      <LogOut className="h-4 w-4" />
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  );
}
