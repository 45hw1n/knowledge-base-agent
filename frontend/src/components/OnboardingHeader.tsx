import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Button } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { cn } from "@/lib/utils";
import {
  GET_BANK_ACCOUNTS,
  type BankAccount,
} from "@/features/bank-accounts/bankAccount.types";
import {
  GET_CREDIT_CARDS,
  type CreditCard,
} from "@/features/credit-cards/creditCard.types";
import { toast } from "sonner";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { useAppStore } from "@/store/appStore";
import { GetGooglePermissions } from "@/components/GetGooglePermissions";

const ONBOARD_USER = gql`
  mutation OnboardUser($input: OnboardUserInput!) {
    onboardUser(input: $input) {
      success
      message
      data {
        isBetaUser
        autoProcess
        googleSheetId
        onboarded
      }
    }
  }
`;

type ChecklistStatus = {
  leadingIcon: string;
  stateIcon: string;
  title: string;
  description: string;
  targetId: string;
};

interface ChecklistItemProps {
  status: ChecklistStatus;
}

function scrollToSection(targetId: string) {
  const element = document.getElementById(targetId);
  if (!element) return;

  element.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function ChecklistItem({ status }: ChecklistItemProps) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(status.targetId)}
      className={cn(
        "group/item flex h-full w-full flex-col justify-between rounded-lg border border-border/50",
        "bg-muted/30 p-4 text-left transition hover:border-border hover:bg-black hover:text-white",
        "cursor-pointer"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{status.stateIcon}</span>
          <span className="text-base leading-none">{status.leadingIcon}</span>
          <span className="font-medium text-foreground group-hover/item:text-white">{status.title}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground group-hover/item:text-white/70">
          {status.description}
        </p>
      </div>
    </button>
  );
}

function getGoogleSheetStatus(hasSheetId: boolean): ChecklistStatus {
  return hasSheetId
    ? {
        stateIcon: "✅",
        leadingIcon: "📊",
        title: "Google Sheet",
        description: "We’ll automatically sync your transactions to your sheet",
        targetId: "google-sheet-section",
      }
    : {
        stateIcon: "⚠️",
        leadingIcon: "📊",
        title: "Google Sheet",
        description:
          "Connect your Google sheet ID to sync and organize your transactions",
        targetId: "google-sheet-section",
      };
}

function getBankStatus(bankAccountsCount: number): ChecklistStatus {
  return bankAccountsCount > 0
    ? {
        stateIcon: "✅",
        leadingIcon: "🏦",
        title: "Bank Accounts",
        description: `${bankAccountsCount} account(s) connected and ready`,
        targetId: "bank-accounts-section",
      }
    : {
        stateIcon: "⚠️",
        leadingIcon: "🏦",
        title: "Bank Accounts",
        description: "Add at least one account to start tracking your finances",
        targetId: "bank-accounts-section",
      };
}

function getCreditCardStatus(creditCardsCount: number): ChecklistStatus {
  return creditCardsCount > 0
    ? {
        stateIcon: "✅",
        leadingIcon: "💳",
        title: "Credit Cards",
        description: `${creditCardsCount} card(s) added to track your spending`,
        targetId: "credit-cards-section",
      }
    : {
        stateIcon: "⏳",
        leadingIcon: "💳",
        title: "Credit Cards",
        description: "Add cards to track spends, billing cycles, and due dates",
        targetId: "credit-cards-section",
      };
}

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

  const { data: bankData } = useQuery<{ getBankAccounts: BankAccount[] }>(
    GET_BANK_ACCOUNTS
  );
  const { data: creditCardData } = useQuery<{ getCreditCards: CreditCard[] }>(
    GET_CREDIT_CARDS
  );

  const sheetId = userPreferences?.googleSheetId ?? "";
  const autoProcess = userPreferences?.autoProcess ?? false;
  const hasSheetId = Boolean(sheetId);
  const bankAccountsCount = bankData?.getBankAccounts?.length ?? 0;
  const creditCardsCount = creditCardData?.getCreditCards?.length ?? 0;
  const firstName = user?.displayName?.split(" ")?.[0] || "Ashwin";
  const canCompleteOnboarding = hasSheetId && bankAccountsCount > 0;
  const isOnboarded = Boolean(appStatus?.onboarded);

  const SCOPE_LABELS: Record<string, string> = {
    GMAIL_READONLY: "Gmail Read-Only",
    SPREADSHEETS: "Google Sheets",
  };
  const REQUIRED_SCOPES = ["GMAIL_READONLY", "SPREADSHEETS"] as const;
  const missingScopes = REQUIRED_SCOPES.filter((s) => !user?.grantedScopes?.[s]);
  const hasAllPermissions = missingScopes.length === 0;

  const checklistItems = useMemo(
    () => [
      getGoogleSheetStatus(hasSheetId),
      getBankStatus(bankAccountsCount),
      getCreditCardStatus(creditCardsCount),
    ],
    [hasSheetId, bankAccountsCount, creditCardsCount]
  );

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
        googleSheetId: result.data.googleSheetId,
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
          googleSheetId: sheetId,
        },
      },
    });
  }

  return (
    <Card className="w-full p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isOnboarded ? (
                <>✅ Setup complete, {firstName}</>
              ) : (
                <>
                  {"👋 Welcome, "}
                  {firstName}
                  {" — let’s finish setting things up"}
                </>
              )}
            </h1>
            <div>
              <p className="text-base leading-relaxed text-foreground/90">
                {isOnboarded
                  ? "Your setup is complete — start tracking your finances and uncover insights from your data. All your transactions will be automatically synced to your Google Sheet."
                  : "To give you accurate insights and predictions, we need a few details like your Google Sheet, bank accounts, and credit cards."}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                ✨ Your data is used only to generate insights from your
                transactions — 🔒 it is encrypted, secure, and never shared or
                misused.
              </p>
            </div>
          </div>
        </div>

        {!isOnboarded && (
          <div className="flex shrink-0 items-start">
            {!hasAllPermissions ? (
              <GetGooglePermissions
                missingScopes={missingScopes.map((s) => SCOPE_LABELS[s])}
              />
            ) : (
              <Button
                size="lg"
                disabled={!canCompleteOnboarding || isOnboarding}
                onClick={handleCompleteOnboarding}
                className="min-w-52"
              >
                {isOnboarding ? "Completing..." : "Complete Onboarding"}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {checklistItems.map((status) => (
          <ChecklistItem key={status.title} status={status} />
        ))}
      </div>
    </Card>
  );
}
