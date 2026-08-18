import { AccessTokenRevokedAlert } from "@/components/AccessTokenRevokedAlert";
import { PageContent } from "@/components/page-layout";
import { ProcessDebitEmailAlert } from "@/components/ProcessDebitEmailAlert";

// TODO: rewrite for Cortex — replace this placeholder with the real
// knowledge-base home (recent ingested emails / extracted entities / search).
export default function HomePage() {
  return (
    <PageContent>
      <AccessTokenRevokedAlert />
      <ProcessDebitEmailAlert />
      <div className="flex flex-col items-start gap-1">
        <h2 className="text-xl font-semibold tracking-tight">Home</h2>
        <p className="text-sm text-muted-foreground">Coming soon.</p>
      </div>
    </PageContent>
  );
}
