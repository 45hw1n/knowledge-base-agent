import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/lib/ui/button";
import { Card, CardContent } from "@/lib/ui/card";
import { Input } from "@/lib/ui/input";
import { Label } from "@/lib/ui/label";
import { useLazyQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { LOGIN_WITH_GOOGLE_QUERY } from "@/graphql/queries/auth/login";
import config from "@/lib/config";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const setUser = useAppStore((state) => state.setUser);

  const [getLoginUrl, { loading, error }] = useLazyQuery(
    LOGIN_WITH_GOOGLE_QUERY,
    {
      fetchPolicy: "network-only",
    },
  );

  const handleGoogleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const { data } = await getLoginUrl();

      let url = data?.loginWithGoogle;

      if (url) {
        try {
          // ✅ Attach state only for local/dev
          const finalUrl = new URL(url);

          if (config.isLocal) {
            finalUrl.searchParams.set("state", window.location.origin);
          }

          url = finalUrl.toString();

          // Read once by AppInitializer after the OAuth redirect completes,
          // to distinguish "just logged in" from a plain page reload of an
          // already-authenticated session — sessionStorage survives the
          // full-page redirect but not a fresh tab/browser restart.
          sessionStorage.setItem("justLoggedIn", "1");

          console.log("Redirecting to:", url);
          window.location.href = url;
        } catch (e) {
          console.error("Invalid Google auth URL:", url);
        }
      }
    } catch (err) {
      console.error("Google login error:", err);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <form
            className="flex items-center justify-center p-8 md:p-10"
            onSubmit={handleGoogleLogin}
          >
            <div className="flex flex-col gap-8 w-full max-w-sm">
              <div className="flex flex-col items-center text-center gap-2">
                <span className="text-sm font-semibold tracking-wide text-muted-foreground">
                  Cortex
                </span>
                <h1 className="text-2xl font-bold tracking-tight">
                  Login to Cortex
                </h1>
                <p className="text-sm text-foreground leading-relaxed">
                  Your knowledge base for email intelligence — ingest, extract,
                  and query.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-medium"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    Signing in...
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    Continue with Google
                  </span>
                )}
              </Button>

              <div className="flex flex-col gap-1.5 mt-2 opacity-60">
                <p className="text-center text-xs leading-relaxed">
                  Connect your Gmail so Cortex can ingest and extract
                  structured knowledge from your emails.
                </p>
                <p className="text-center text-xs leading-relaxed">
                  🔒 Your data is encrypted, secure, and used only to build
                  your knowledge base.
                </p>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
