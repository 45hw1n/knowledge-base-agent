import { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Alert, AlertDescription, AlertTitle } from "@/lib/ui/alert";
import { Button } from "@/lib/ui/button";

const DEBIT_EMAIL_STATUSES = ["DETECTED", "LLM_ERROR", "RETRY_PENDING", "FAILED"] as const;

const GET_DEBIT_EMAILS_TO_PROCESS_BY_STATUS = gql`
  query GetDebitEmailsToProcessByStatus($input: GetDebitEmailsByStatusInput!) {
    getDebitEmailsToProcessByStatus(input: $input) {
      count
      data {
        status
        ids
      }
    }
  }
`;

const PROCESS_DEBIT_EMAILS = gql`
  mutation ProcessDebitEmails($input: ProcessDebitEmailsInput) {
    processDebitEmails(input: $input) {
      success
      message
      queuedCount
    }
  }
`;

const GET_APP_STATUS = gql`
  query GetAppStatus {
    getAppStatus {
      debitProcessingInProgress
    }
  }
`;

type GetAppStatusResponse = {
  getAppStatus: {
    debitProcessingInProgress: boolean;
  };
};

type DebitEmailsByStatusItem = {
  status: string;
  ids: string[];
};

type GetDebitEmailsToProcessByStatusResponse = {
  getDebitEmailsToProcessByStatus: {
    count: number;
    data: DebitEmailsByStatusItem[];
  };
};

type ProcessDebitEmailsResponse = {
  processDebitEmails: {
    success: boolean;
    message?: string | null;
    queuedCount: number;
  };
};

export function ProcessDebitEmailAlert() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  const { data, loading, refetch } =
    useQuery<GetDebitEmailsToProcessByStatusResponse>(
      GET_DEBIT_EMAILS_TO_PROCESS_BY_STATUS,
      {
        variables: {
          input: {
            statuses: [...DEBIT_EMAIL_STATUSES],
          },
        },
        fetchPolicy: "network-only",
        notifyOnNetworkStatusChange: true,
      }
    );

  const [processDebitEmails] = useMutation<ProcessDebitEmailsResponse>(
    PROCESS_DEBIT_EMAILS
  );

  const { data: appStatusData } = useQuery<GetAppStatusResponse>(GET_APP_STATUS, {
    pollInterval: isProcessing ? 3000 : 0,
    fetchPolicy: "network-only",
  });

  const serverProcessing =
    appStatusData?.getAppStatus?.debitProcessingInProgress ?? false;

  useEffect(() => {
    if (serverProcessing && !isProcessing) {
      setIsProcessing(true);
    }
  }, [serverProcessing]);

  useEffect(() => {
    if (!serverProcessing && isProcessing) {
      setIsProcessing(false);
      refetch({ input: { statuses: [...DEBIT_EMAIL_STATUSES] } });
    }
  }, [serverProcessing]);

  const flattenedIds = useMemo(
    () =>
      data?.getDebitEmailsToProcessByStatus?.data?.flatMap((item) => item.ids) ??
      [],
    [data]
  );

  const pendingCount = data?.getDebitEmailsToProcessByStatus?.count ?? 0;

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
      const response = await processDebitEmails({
        variables: {
          input: {
            ids,
          },
        },
      });

      if (!response.data?.processDebitEmails?.success) {
        throw new Error(
          response.data?.processDebitEmails?.message ||
            "Something went wrong while processing transactions"
        );
      }

      if (response.data.processDebitEmails.message === 'Processing already in progress') {
        return;
      }

      const refreshed = await refetch({
        input: {
          statuses: [...DEBIT_EMAIL_STATUSES],
        },
      });

      const refreshedCount =
        refreshed.data?.getDebitEmailsToProcessByStatus?.count ?? 0;
      const refreshedIds =
        refreshed.data?.getDebitEmailsToProcessByStatus?.data?.flatMap(
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
          : "Something went wrong while processing transactions"
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
              ⚠️ Something went wrong while processing transactions
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
          ✅ All emails synced
        </AlertTitle>
        <AlertDescription className="mt-1 text-sm text-emerald-200/80">
        Your emails have been processed and synced to your Google Sheet.
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
            transaction emails ready to process
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm text-muted-foreground">
          Process them to generate insights and sync transactions to your Google sheet.
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
