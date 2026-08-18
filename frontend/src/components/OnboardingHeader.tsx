import { gql, useMutation } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { toast } from "sonner";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { useAppStore } from "@/store/appStore";

const ONBOARD_USER = gql`
  mutation OnboardUser($input: OnboardUserInput!) {
    onboardUser(input: $input) {
      success
      message
      data {
        isBetaUser
        autoProcess
        onboarded
      }
    }
  }
`;

// TODO: rewrite for Cortex — replace this minimal placeholder with a real
// onboarding checklist once the KB entity-extraction flow is designed.
export function OnboardingHeader() {
  const user = useAppStore((state) => state.user);
  const appStatus = useAppStore((state) => state.appStatus);
  const setAppStatus = useAppStore((state) => state.setAppStatus);
  const userPreferences = useUserPreferencesStore(
    (state) => state.userPreferences
  );
  const setUserPreferences = useUserPreferencesStore(
    (state) => state.setUserPreferences
  );

  const autoProcess = userPreferences?.autoProcess ?? false;
  const firstName = user?.displayName?.split(" ")?.[0] || "there";
  const isOnboarded = Boolean(appStatus?.onboarded);

  const navigate = useNavigate();

  const [onboardUser, { loading: isOnboarding }] = useMutation(ONBOARD_USER, {
    onCompleted: (response) => {
      const result = response?.onboardUser;

      if (!result?.success || !result.data) {
        toast.error(result?.message || "Failed to complete onboarding");
        return;
      }

      setUserPreferences({
        ...(userPreferences ?? {}),
        isBetaUser: result.data.isBetaUser,
        autoProcess: result.data.autoProcess,
      });

      setAppStatus({
        ...(appStatus ?? {}),
        onboarded: result.data.onboarded,
      });

      toast.success(result.message);
      navigate("/home", { replace: true });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to complete onboarding");
    },
  });

  async function handleCompleteOnboarding() {
    await onboardUser({
      variables: {
        input: {
          isBetaUser: true,
          autoProcess,
        },
      },
    });
  }

  return (
    <Card className="w-full p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isOnboarded ? (
              <>✅ Setup complete, {firstName}</>
            ) : (
              <>👋 Welcome, {firstName} — let's get you set up</>
            )}
          </h1>
          <p className="text-base leading-relaxed text-foreground/90">
            {isOnboarded
              ? "Your Gmail is connected and syncing."
              : "Connect your Gmail to start ingesting emails."}
          </p>
        </div>

        {!isOnboarded && (
          <div className="flex shrink-0 items-start">
            <Button
              size="lg"
              disabled={isOnboarding}
              onClick={handleCompleteOnboarding}
              className="min-w-52"
            >
              {isOnboarding ? "Completing..." : "Complete Onboarding"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
