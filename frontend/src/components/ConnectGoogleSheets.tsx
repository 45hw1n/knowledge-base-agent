import { useLazyQuery } from "@apollo/client";
import { Button } from "@/lib/ui/button";
import { useAppStore } from "@/store/appStore";
import { GET_SHEETS_AUTH_URL } from "@/graphql/queries/auth/sheetsAuth";

interface ConnectGoogleSheetsProps {
  onAlreadyConnected?: () => void;
}

export function ConnectGoogleSheets({ onAlreadyConnected }: ConnectGoogleSheetsProps) {
  const user = useAppStore((s) => s.user);
  const hasSheetsAccess =
    user?.grantedScopes?.SPREADSHEETS;

  const [getSheetsUrl, { loading }] = useLazyQuery(GET_SHEETS_AUTH_URL, {
    fetchPolicy: "network-only",
  });

  const handleConnect = async () => {
    if (hasSheetsAccess) {
      onAlreadyConnected?.();
      return;
    }

    try {
      const { data } = await getSheetsUrl();
      const url = data?.getSheetsAuthUrl;
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to get Sheets auth URL:", err);
    }
  };

  if (hasSheetsAccess) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Google Sheets connected
      </div>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={loading}
      className="gap-2"
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#43A047" d="M37 45H11a4 4 0 01-4-4V7a4 4 0 014-4h17l13 13v25a4 4 0 01-4 4z"/>
        <path fill="#C8E6C9" d="M40 16H28V4z"/>
        <path fill="#2E7D32" d="M30 16l10 10V16z"/>
        <path fill="#E8F5E9" d="M31 35H17v-2h14v2zm0-4H17v-2h14v2zm0-4H17v-2h14v2z"/>
      </svg>
      {loading ? "Connecting..." : "Connect Google Sheets"}
    </Button>
  );
}
