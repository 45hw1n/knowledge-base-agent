import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BankAccountList } from "@/features/bank-accounts/BankAccountList";
import { CreditCardList } from "@/features/credit-cards/CreditCardList";
import { AutoProcessToggle } from "@/components/AutoProcessToggle";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { GoogleSheetId } from "@/components/GoogleSheetId";
import { OnboardingHeader } from "@/components/OnboardingHeader";
import { PageContent } from "@/components/page-layout";

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("sheets_connected") === "true") {
      toast.success("Google Sheets connected successfully!");
      searchParams.delete("sheets_connected");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <PageContent>
      <OnboardingHeader />

      <section className="w-full space-y-4">
        <GoogleSheetId />
      </section>

      <section className="w-full space-y-4">
        <AutoProcessToggle persistOnChange />
      </section>

      <section className="w-full space-y-4">
        <PrivacyToggle persistOnChange/>
      </section>

      <BankAccountList />
      <CreditCardList />
    </PageContent>
  );
}
