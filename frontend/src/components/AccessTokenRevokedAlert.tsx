import { useMutation } from "@apollo/client";
import { Alert, AlertDescription, AlertTitle } from "@/lib/ui/alert";
import { Button } from "@/lib/ui/button";
import { LOGOUT } from "@/graphql/query/auth/authQueries";
import { useAppStore } from "@/store/appStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { useTableStore } from "@/store/useTableStore";
import { apolloClient } from "@/lib/apollo";

export function AccessTokenRevokedAlert() {
  const { user } = useAppStore();

  const [logout, { loading }] = useMutation(LOGOUT, {
    onCompleted: async () => {
      useAppStore.setState({ user: null, appStatus: null, initialized: false });
      useUserPreferencesStore.setState({ userPreferences: null });
      useTableStore.setState({ tables: {} });

      await apolloClient.clearStore();

      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      window.location.href = "/";
    },
  });

  if (!user?.gmailAuthRevoked) {
    return null;
  }

  return (
    <Alert className="border-l-4 border-yellow-500/30 border-l-yellow-500 bg-yellow-500/10 text-foreground">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-base font-semibold tracking-tight text-yellow-400">
            ⚠️ Google token expired
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-muted-foreground">
            Please logout and re-login to continue
          </AlertDescription>
        </div>
        <Button
          onClick={() => logout()}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </Alert>
  );
}
