import { PageContent } from "@/components/page-layout";
import { ManualEntriesTable } from "@/features/knowledge/ManualEntriesTable";

export default function ManualEntriesPage() {
  return (
    <PageContent>
      <section className="w-full space-y-4">
        <div className="flex flex-col items-start gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Manual Entries</h2>
          <p className="text-sm text-muted-foreground">
            Manually created entities that are still processing or failed to complete.
          </p>
        </div>
        <ManualEntriesTable />
      </section>
    </PageContent>
  );
}
