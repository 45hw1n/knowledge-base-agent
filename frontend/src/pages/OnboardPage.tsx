import { AutoProcessToggle } from "@/components/AutoProcessToggle";
import { OnboardingHeader } from "@/components/OnboardingHeader";
import { ProcessDebitEmailAlert } from "@/components/ProcessDebitEmailAlert";
import { AccessTokenRevokedAlert } from "@/components/AccessTokenRevokedAlert";

export default function OnboardPage() {
  return (
    <div className="flex-1 w-full flex flex-col p-6 space-y-8 overflow-y-auto overflow-x-hidden">
      <AccessTokenRevokedAlert />
      <ProcessDebitEmailAlert />
      <OnboardingHeader />

      <section className="w-full space-y-4">
        <AutoProcessToggle />
      </section>
    </div>
  );
}
