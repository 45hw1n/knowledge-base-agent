import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BankAccountList } from "@/features/bank-accounts/BankAccountList";
import { CreditCardList } from "@/features/credit-cards/CreditCardList";
import { AutoProcessToggle } from "@/components/AutoProcessToggle";
import { GoogleSheetId } from "@/components/GoogleSheetId";
import { OnboardingHeader } from "@/components/OnboardingHeader";
import { ProcessDebitEmailAlert } from "@/components/ProcessDebitEmailAlert";
import { AccessTokenRevokedAlert } from "@/components/AccessTokenRevokedAlert";

export default function OnboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("sheets_connected") === "true") {
      toast.success("Google Sheets connected successfully!");
      searchParams.delete("sheets_connected");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex-1 w-full flex flex-col p-6 space-y-8 overflow-y-auto overflow-x-hidden">
      <AccessTokenRevokedAlert />
      <ProcessDebitEmailAlert />
      <OnboardingHeader />

      <section className="w-full space-y-4">
        <GoogleSheetId hideButton/>
      </section>

      <section className="w-full space-y-4">
        <AutoProcessToggle />
      </section>

      <BankAccountList />
      <CreditCardList />
    </div>
  );
}
