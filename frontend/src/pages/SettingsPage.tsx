import { AutoProcessToggle } from "@/components/AutoProcessToggle";
import { PageContent } from "@/components/page-layout";

export default function SettingsPage() {
  return (
    <PageContent>
      <section className="w-full space-y-4">
        <AutoProcessToggle persistOnChange />
      </section>
    </PageContent>
  );
}
