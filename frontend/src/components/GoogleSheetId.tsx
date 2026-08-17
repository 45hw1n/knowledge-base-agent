import { useEffect, useState } from "react";
import { CircleCheckBig } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { Button } from "@/lib/ui/button";
import { GoogleSheetIdInput } from "./GoogleSheetIdInput";
import { ConnectGoogleSheets } from "./ConnectGoogleSheets";

type GoogleSheetIdProps = {
  hideButton?: boolean;
};

export function GoogleSheetId({ hideButton = false }: GoogleSheetIdProps) {
  const user = useAppStore((state) => state.user);
  const userPreferences = useUserPreferencesStore(
    (state) => state.userPreferences,
  );
  const setUserPreferences = useUserPreferencesStore(
    (state) => state.setUserPreferences,
  );

  const isGoogleSheetScopesAdded = user?.grantedScopes?.SPREADSHEETS;

  const savedGoogleSheetId = userPreferences?.googleSheetId ?? "";
  const isDisabled = !isGoogleSheetScopesAdded;

  const [draftGoogleSheetId, setDraftGoogleSheetId] =
    useState(savedGoogleSheetId);

  useEffect(() => {
    setDraftGoogleSheetId(savedGoogleSheetId);
  }, [savedGoogleSheetId]);

  const hasChanges =
    draftGoogleSheetId.trim() !== savedGoogleSheetId.trim();
  const isUpdateEnabled = hasChanges && isGoogleSheetScopesAdded && draftGoogleSheetId.trim().length > 0;

  function handleInputChange(value: string) {
    setDraftGoogleSheetId(value);
    if (!hideButton && savedGoogleSheetId) return;
    setUserPreferences({
      ...(userPreferences ?? {}),
      googleSheetId: value,
    });
  }

  return (
    <section id="google-sheet-section" className="w-full space-y-4">
      <div className="flex justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            <span className="mr-2">📊</span> Google Sheet
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter the Google Sheet ID to sync your transactions.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ConnectGoogleSheets />
          {!hideButton && (
            <Button type="button" disabled={!isUpdateEnabled}>
              <CircleCheckBig className="size-4" />
              Update
            </Button>
          )}
        </div>
      </div>

      <GoogleSheetIdInput
        value={draftGoogleSheetId}
        isDisabled={isDisabled}
        onChange={handleInputChange}
        placeholder={
          !isGoogleSheetScopesAdded
            ? "Grant Google permissions to proceed"
            : null
        }
      />
    </section>
  );
}
