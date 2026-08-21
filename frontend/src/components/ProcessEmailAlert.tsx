import { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Alert, AlertDescription, AlertTitle } from "@/lib/ui/alert";
import { Button } from "@/lib/ui/button";
import { GET_EMAILS_TO_PROCESS_BY_STATUS, PROCESS_EMAILS } from "@/graphql/query/emails/emailSyncQueries";

const PROCESSABLE_EMAIL_STATUSES = ["DETECTED", "LLM_ERROR", "RETRY_PENDING", "FAILED"] as const;

const GET_APP_STATUS = gql`
  query GetAppStatus {
    getAppStatus {
      emailProcessingInProgress
    }
  }
`;

type GetAppStatusResponse = {
  getAppStatus: {
    emailProcessingInProgress: boolean;
  };
};

type EmailsByStatusItem = {
  status: string;
  ids: string[];
};

type GetEmailsToProcessByStatusResponse = {
  getEmailsToProcessByStatus: {
    count: number;
    data: EmailsByStatusItem[];
  };
};

type ProcessEmailsResponse = {
  processEmails: {
    success: boolean;
    message?: string | null;
    queuedCount: number;
  };
};

export function ProcessEmailAlert() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  const { data, loading, refetch } =
    useQuery<GetEmailsToProcessByStatusResponse>(
      GET_EMAILS_TO_PROCESS_BY_STATUS,
      {
        variables: {
          input: {
            statuses: [...PROCESSABLE_EMAIL_STATUSES],
          },
        },
        fetchPolicy: "network-only",
        notifyOnNetworkStatusChange: true,
      }
    );

  const [processEmails] = useMutation<ProcessEmailsResponse>(
    PROCESS_EMAILS
  );

  const { data: appStatusData } = useQuery<GetAppStatusResponse>(GET_APP_STATUS, {
    pollInterval: isProcessing ? 3000 : 0,
    fetchPolicy: "network-only",
  });

  const serverProcessing =
    appStatusData?.getAppStatus?.emailProcessingInProgress ?? false;

  useEffect(() => {
    if (serverProcessing && !isProcessing) {
      setIsProcessing(true);
    }
  }, [serverProcessing]);

  useEffect(() => {
    if (!serverProcessing && isProcessing) {
      setIsProcessing(false);
      refetch({ input: { statuses: [...PROCESSABLE_EMAIL_STATUSES] } });
    }
  }, [serverProcessing]);

  const flattenedIds = useMemo(
    () =>
      data?.getEmailsToProcessByStatus?.data?.flatMap((item) => item.ids) ??
      [],
    [data]
  );

  const pendingCount = data?.getEmailsToProcessByStatus?.count ?? 0;

  useEffect(() => {
    setIds(flattenedIds);
    setCount(pendingCount);

    if (pendingCount > 0) {
      setIsVisible(true);
      setIsSuccess(false);
      setErrorMessage("");
    }
  }, [flattenedIds, pendingCount]);

  useEffect(() => {
    if (!isSuccess) return;

    const timeout = window.setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [isSuccess]);

  async function handleProcessNow() {
    if (isProcessing || ids.length === 0) return;

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const response = await processEmails({
        variables: {
          input: {
            ids,
          },
        },
      });

      if (!response.data?.processEmails?.success) {
        throw new Error(
          response.data?.processEmails?.message ||
            "Something went wrong while processing emails"
        );
      }

      if (response.data.processEmails.message === 'Processing already in progress') {
        return;
      }

      const refreshed = await refetch({
        input: {
          statuses: [...PROCESSABLE_EMAIL_STATUSES],
        },
      });

      const refreshedCount =
        refreshed.data?.getEmailsToProcessByStatus?.count ?? 0;
      const refreshedIds =
        refreshed.data?.getEmailsToProcessByStatus?.data?.flatMap(
          (item) => item.ids
        ) ?? [];

      setCount(refreshedCount);
      setIds(refreshedIds);

      if (refreshedCount === 0) {
        setIsSuccess(true);
        setIsVisible(true);
      }
    } catch (error) {
      setIsSuccess(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while processing emails"
      );
      setIsVisible(true);
      setIsProcessing(false);
    }
  }

  if (!isVisible || loading) {
    return null;
  }

  if (!isSuccess && !errorMessage && count === 0) {
    return null;
  }

  if (errorMessage) {
    return (
      <Alert className="border-l-4 border-red-500/30 border-l-red-500 bg-red-500/10 text-foreground">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <AlertTitle className="text-base font-semibold tracking-tight text-red-400">
              ⚠️ Something went wrong while processing emails
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm text-muted-foreground">
              {errorMessage}
            </AlertDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleProcessNow}
            disabled={isProcessing || ids.length === 0}
            className="shrink-0"
          >
            {isProcessing ? "Processing..." : "Retry"}
          </Button>
        </div>
      </Alert>
    );
  }

  if (isSuccess) {
    return (
      <Alert
        className="border-l-4 border-emerald-500/30 border-l-emerald-500 bg-emerald-500/10 text-emerald-50"
      >
        <AlertTitle className="text-base font-semibold tracking-tight">
          ✅ All emails processed
        </AlertTitle>
        <AlertDescription className="mt-1 text-sm text-emerald-200/80">
        Cortex has extracted everything it could from your inbox.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-l-4 border-border/60 border-l-violet-500 bg-card/70 text-foreground backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-base font-semibold tracking-tight">
            📩 We found{" "}
            <span className="tabular-nums text-violet-400">{count}</span>{" "}
            emails ready to process
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-muted-foreground">
          Process them to extract entities into your knowledge base.
          </AlertDescription>
        </div>
        <Button
          onClick={handleProcessNow}
          disabled={isProcessing || ids.length === 0}
          className="shrink-0"
        >
          {isProcessing ? "Processing..." : "Process Now"}
        </Button>
      </div>
    </Alert>
  );
}
