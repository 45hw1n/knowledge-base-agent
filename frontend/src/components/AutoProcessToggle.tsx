import { useEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { UPDATE_USER_PREFERENCES } from "@/graphql/query/auth/userPreferencesMutations";
import { Switch } from "@/lib/ui/switch";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";

const DEBOUNCE_MS = 500;

type AutoProcessToggleProps = {
  persistOnChange?: boolean;
};

export function AutoProcessToggle({
  persistOnChange = false,
}: AutoProcessToggleProps) {
  const userPreferences = useUserPreferencesStore(
    (state) => state.userPreferences,
  );
  const setUserPreferences = useUserPreferencesStore(
    (state) => state.setUserPreferences,
  );

  const savedAutoProcess = userPreferences?.autoProcess ?? false;

  const [checked, setChecked] = useState(savedAutoProcess);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [updateUserPreferences, { loading: isSaving }] = useMutation(
    UPDATE_USER_PREFERENCES,
    {
      onCompleted: (response) => {
        const updated = response?.updateUserPreferences;
        if (!updated) return;

        const currentPreferences =
          useUserPreferencesStore.getState().userPreferences;
        setUserPreferences({
          ...(currentPreferences ?? {}),
          autoProcess: updated.autoProcess,
          isBetaUser: updated.isBetaUser,
        });
      },
      onError: (error, clientOptions) => {
        const previousValue =
          clientOptions?.context?.previousValue ?? savedAutoProcess;

        setChecked(previousValue);
        const currentPreferences =
          useUserPreferencesStore.getState().userPreferences;
        setUserPreferences({
          ...(currentPreferences ?? {}),
          autoProcess: previousValue,
        });
        toast.error(error.message || "Failed to update auto save preference");
      },
    },
  );

  useEffect(() => {
    setChecked(savedAutoProcess);
  }, [savedAutoProcess]);

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
    setUserPreferences({
      ...(userPreferences ?? {}),
      autoProcess: value,
    });

    if (!persistOnChange) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      updateUserPreferences({
        variables: { input: { autoProcess: value } },
        context: { previousValue },
      });
    }, DEBOUNCE_MS);
  }

  return (
    <section id="auto-process-section" className="w-full space-y-4">
      <div className="flex justify-between items-center gap-8">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            <span className="mr-2 inline size-5 align-text-bottom"> ✨</span>
            Auto process transactions
          </h2>
          <p className="text-sm text-muted-foreground">
            When Auto-Process is enabled, transactions are automatically
            formatted, saved, and synced to your Google Sheet by AI without
            requiring approval. <br />
            You can review and edit them at any time.
          </p>
        </div>
        <Switch
          checked={checked}
          disabled={persistOnChange && isSaving}
          onCheckedChange={handleCheckedChange}
        />
      </div>
    </section>
  );
}
