import { AutoProcessToggle } from "@/components/AutoProcessToggle";
import { OnboardingHeader } from "@/components/OnboardingHeader";
import { PageContent } from "@/components/page-layout";

export default function SettingsPage() {
  return (
    <PageContent>
      <OnboardingHeader />

      <section className="w-full space-y-4">
        <AutoProcessToggle persistOnChange />
      </section>
    </PageContent>
  );
}
