import { useEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { UPDATE_APP_STATUS } from "@/graphql/query/auth/appStatusMutations";
import { Switch } from "@/lib/ui/switch";
import { useAppStore } from "@/store/appStore";

const DEBOUNCE_MS = 500;

type PrivacyToggleProps = {
  persistOnChange?: boolean;
  variant?: "page" | "popover";
};

export function PrivacyToggle({
  persistOnChange = false,
  variant = "page",
}: PrivacyToggleProps) {
  const appStatus = useAppStore((state) => state.appStatus);
  const setAppStatus = useAppStore((state) => state.setAppStatus);

  const savedShowPrivate = appStatus?.showPrivateEntity ?? false;

  const [checked, setChecked] = useState(savedShowPrivate);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [updateAppStatus, { loading: isSaving }] = useMutation(
    UPDATE_APP_STATUS,
    {
      onCompleted: (response) => {
        const updated = response?.updateAppStatus;
        if (!updated) return;

        const currentStatus = useAppStore.getState().appStatus;
        setAppStatus({
          ...(currentStatus ?? {}),
          showPrivateEntity: updated.showPrivateEntity,
        });
      },
      onError: (error, clientOptions) => {
        const previousValue =
          clientOptions?.context?.previousValue ?? savedShowPrivate;

        setChecked(previousValue);
        const currentStatus = useAppStore.getState().appStatus;
        setAppStatus({
          ...(currentStatus ?? {}),
          showPrivateEntity: previousValue,
        });
        toast.error(error.message || "Failed to update privacy preference");
      },
    },
  );

  useEffect(() => {
    setChecked(savedShowPrivate);
  }, [savedShowPrivate]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function handleCheckedChange(value: boolean) {
    const previousValue = checked;
    setChecked(value);
    setAppStatus({
      ...(appStatus ?? {}),
      showPrivateEntity: value,
    });

    if (!persistOnChange) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      updateAppStatus({
        variables: { input: { showPrivateEntity: value } },
        context: { previousValue },
      });
    }, DEBOUNCE_MS);
  }

  const switchControl = (
    <Switch
      checked={checked}
      disabled={persistOnChange && isSaving}
      onCheckedChange={handleCheckedChange}
      className={variant === "popover" ? "shrink-0" : undefined}
    />
  );

  if (variant === "popover") {
    return (
      <div className="w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-medium">🔒 Show private transaction</h3>
            <p className="text-xs text-muted-foreground">
              Include transactions marked as private when viewing your financial
              data.
            </p>
          </div>
          {switchControl}
        </div>
      </div>
    );
  }

  return (
    <section id="privacy-toggle-section" className="w-full space-y-4">
      <div className="flex items-center justify-between gap-8">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            🔒 Show private transactions
          </h2>
          <p className="text-sm text-muted-foreground">
            Include transactions marked as private when viewing your financial
            data. Private transactions are only visible to you and are never
            shared with groups.
          </p>
        </div>
        {switchControl}
      </div>
    </section>
  );
}
