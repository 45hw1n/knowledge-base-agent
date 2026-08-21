import { useEffect } from "react";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  GET_CURRENT_USER,
  GET_APP_STATUS,
  GET_USER_PREFERENCES,
} from "../graphql/query/auth/authQueries";
import { SYNC_EMAILS, PROCESS_EMAILS } from "../graphql/query/emails/emailSyncQueries";
import { useAppStore } from "../store/appStore";
import { useUserPreferencesStore } from "../store/userPreferencesStore";
import { refreshTableByKey } from "../store/useTableStore";

const JUST_LOGGED_IN_KEY = "justLoggedIn";
const HOME_PATH = "/home";
const ENTITIES_TABLE_KEY = "entities__entities";

export const AppInitializer = () => {
  const client = useApolloClient();
  const navigate = useNavigate();

  const setUser = useAppStore((s) => s.setUser);
  const setAppStatus = useAppStore((s) => s.setAppStatus);
  const setInitialized = useAppStore((s) => s.setInitialized);
  const setUserPreferences = useUserPreferencesStore((s) => s.setUserPreferences);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await client.query({
          query: GET_CURRENT_USER,
          fetchPolicy: "network-only",
        });

        const user = data?.currentUser ?? null;

        if (!user) {
          setUser(null);
          setAppStatus(null);
          setUserPreferences(null);
          setInitialized(true);
          return;
        }

        setUser(user);

        const [statusResponse, userPreferencesResponse] = await Promise.all([
          client.query({
            query: GET_APP_STATUS,
            fetchPolicy: "network-only",
          }),
          client.query({
            query: GET_USER_PREFERENCES,
            fetchPolicy: "network-only",
          }),
        ]);

        setAppStatus(statusResponse.data.getAppStatus);
        setUserPreferences(userPreferencesResponse.data?.getUserPreferences ?? null);

        setInitialized(true);

        if (sessionStorage.getItem(JUST_LOGGED_IN_KEY)) {
          sessionStorage.removeItem(JUST_LOGGED_IN_KEY);
          // Fire-and-forget — the app renders immediately, the toast tracks
          // sync/process progress in the background.
          runAutoSync();
        }
      } catch (error) {
        console.error("App bootstrap failed:", error);
        setUser(null);
        setAppStatus(null);
        setUserPreferences(null);
        setInitialized(true);
      }
    };

    const handleViewEntities = () => {
      if (window.location.pathname === HOME_PATH) {
        refreshTableByKey(ENTITIES_TABLE_KEY, { reset: true });
      } else {
        navigate(HOME_PATH);
      }
    };

    const runAutoSync = async () => {
      const toastId = toast.loading("Syncing emails...");

      try {
        await client.mutate({ mutation: SYNC_EMAILS });

        const { data: processData } = await client.mutate({ mutation: PROCESS_EMAILS });
        const queuedCount = processData?.processEmails?.queuedCount ?? 0;

        if (queuedCount > 0) {
          toast.success(
            `All emails synced. Created ${queuedCount} ${queuedCount === 1 ? "entity" : "entities"}. Click here.`,
            {
              id: toastId,
              action: { label: "View", onClick: handleViewEntities },
            }
          );
        } else {
          toast.success("All emails synced. No new updates.", { id: toastId });
        }
      } catch (error) {
        console.error("Auto-sync on login failed:", error);
        toast.error("Sync failed. Try again from Settings.", { id: toastId });
      }
    };

    bootstrap();
  }, [client, navigate, setUser, setAppStatus, setUserPreferences, setInitialized]);

  return null;
};
