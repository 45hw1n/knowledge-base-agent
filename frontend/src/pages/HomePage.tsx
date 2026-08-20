import { AccessTokenRevokedAlert } from "@/components/AccessTokenRevokedAlert";
import { PageContent } from "@/components/page-layout";
import { ProcessDebitEmailAlert } from "@/components/ProcessDebitEmailAlert";
import { EntityList } from "@/features/entities/EntityList";

// TODO: rewrite the search/chat half for Cortex — this currently only
// covers the "Knowledge" table (see decisions.md's UX sketch). Data is
// mocked (frontend/src/mocks) until the entities GraphQL API exists.
export default function HomePage() {
  return (
    <PageContent>
      <AccessTokenRevokedAlert />
      <ProcessDebitEmailAlert />
      <section className="w-full space-y-4">
        <div className="flex flex-col items-start gap-1">
          <h2 className="text-xl font-semibold tracking-tight">Knowledge</h2>
          <p className="text-sm text-muted-foreground">Everything Cortex has extracted from your inbox.</p>
        </div>
        <EntityList />
      </section>
    </PageContent>
  );
}
