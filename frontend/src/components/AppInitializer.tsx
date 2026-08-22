import { useEffect, useRef, useState } from "react";
import { useApolloClient, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  GET_CURRENT_USER,
  GET_APP_STATUS,
  GET_USER_PREFERENCES,
} from "../graphql/query/auth/authQueries";
import {
  GET_SYNC_STATUS,
  SYNC_EMAILS,
  PROCESS_EMAILS,
} from "../graphql/query/emails/emailSyncQueries";
import { useAppStore } from "../store/appStore";
import type { SyncStatus } from "../store/appStore";
import { useUserPreferencesStore } from "../store/userPreferencesStore";
import { refreshTableByKey } from "../store/useTableStore";

const JUST_LOGGED_IN_KEY = "justLoggedIn";
const HOME_PATH = "/home";
const ENTITIES_TABLE_KEY = "entities__entities";

// Idle polling is slow since most of the time nothing is happening; once a
// sync/process cycle is detected (login-triggered or webhook-triggered), we
// switch to fast polling so the toast/spinner transitions feel responsive.
const IDLE_POLL_MS = 10000;
const SYNCING_POLL_MS = 2000;
const TOAST_DURATION_MS = 5000;

type GetSyncStatusResponse = {
  getAppStatus: SyncStatus;
};

export const AppInitializer = () => {
  const client = useApolloClient();
  const navigate = useNavigate();

  const user = useAppStore((s) => s.user);
  const initialized = useAppStore((s) => s.initialized);
  const setUser = useAppStore((s) => s.setUser);
  const setAppStatus = useAppStore((s) => s.setAppStatus);
  const setInitialized = useAppStore((s) => s.setInitialized);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);
  const setUserPreferences = useUserPreferencesStore((s) => s.setUserPreferences);

  const [pollInterval, setPollInterval] = useState(IDLE_POLL_MS);

  // Edge-detection state for the single toast+indicator state machine below.
  // Shared between the passive poll (webhook-triggered syncs) and the
  // explicit login-triggered sync — there is exactly one code path that
  // creates/resolves a toast, never two competing ones.
  const prevSyncingRef = useRef(false);
  const prevLastSyncedAtRef = useRef<string | null>(null);
  const activeToastIdRef = useRef<string | number | null>(null);
  const isOwnTriggeredRef = useRef(false);

  const { data: syncStatusData } = useQuery<GetSyncStatusResponse>(GET_SYNC_STATUS, {
    fetchPolicy: "network-only",
    pollInterval,
    skip: !initialized || !user,
  });

  const handleViewEntities = () => {
    if (window.location.pathname === HOME_PATH) {
      refreshTableByKey(ENTITIES_TABLE_KEY, { reset: true });
    } else {
      navigate(HOME_PATH);
    }
  };

  /**
   * The one place that decides "are we syncing" and "did we just finish" —
   * fed by both the passive poll and the login flow's own explicit
   * before/after checks. Completion fires on a clean falling edge OR on
   * emailLastSyncedAt having visibly advanced since the last tick even
   * though `syncing` was never observed true — that second branch is what
   * catches a sync/process cycle fast enough to start and finish entirely
   * between two poll ticks, which previously showed no feedback at all.
   */
  const handleStatusTick = (status: SyncStatus | undefined) => {
    if (!status) return;
    setSyncStatus(status);

    const syncing =
      status.emailSyncStatus === "SYNC_IN_PROGRESS" || Boolean(status.emailProcessingInProgress);
    const wasSyncing = prevSyncingRef.current;
    const timestampAdvanced =
      prevLastSyncedAtRef.current !== null && status.emailLastSyncedAt !== prevLastSyncedAtRef.current;

    if (!wasSyncing && syncing && !activeToastIdRef.current) {
      activeToastIdRef.current = toast.loading(
        isOwnTriggeredRef.current ? "Syncing emails..." : "New emails detected. Sync in progress.",
        { closeButton: true }
      );
    }

    const justCompleted = (wasSyncing && !syncing) || (!syncing && timestampAdvanced);

    if (justCompleted) {
      const queuedCount = status.lastEmailAIProcessedCount ?? 0;
      const message =
        queuedCount > 0
          ? `All emails synced. Created ${queuedCount} ${queuedCount === 1 ? "entity" : "entities"}. Click here.`
          : "All emails synced. No new updates.";
      const options =
        queuedCount > 0
          ? {
              action: { label: "View", onClick: handleViewEntities },
              closeButton: true,
              duration: TOAST_DURATION_MS,
            }
          : { closeButton: true, duration: TOAST_DURATION_MS };

      if (activeToastIdRef.current) {
        toast.success(message, { id: activeToastIdRef.current, ...options });
        activeToastIdRef.current = null;
      } else {
        // Pure race case — we never observed the rising edge, so there's no
        // loading toast to resolve. Fire a fresh one-shot success instead.
        toast.success(message, options);
      }
    }

    prevSyncingRef.current = syncing;
    prevLastSyncedAtRef.current = status.emailLastSyncedAt;
    setPollInterval(syncing ? SYNCING_POLL_MS : IDLE_POLL_MS);
  };

  useEffect(() => {
    handleStatusTick(syncStatusData?.getAppStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatusData]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await client.query({
          query: GET_CURRENT_USER,
          fetchPolicy: "network-only",
        });

        const fetchedUser = data?.currentUser ?? null;

        if (!fetchedUser) {
          setUser(null);
          setAppStatus(null);
          setUserPreferences(null);
          setInitialized(true);
          return;
        }

        setUser(fetchedUser);

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

    // Explicit before/after status checks — these, not the passive poll
    // interval, are what give the login-triggered toast a zero-race
    // guarantee regardless of poll timing.
    const checkSyncStatusNow = async () => {
      const { data } = await client.query({
        query: GET_SYNC_STATUS,
        fetchPolicy: "network-only",
      });
      handleStatusTick(data?.getAppStatus);
    };

    const runAutoSync = async () => {
      isOwnTriggeredRef.current = true;
      try {
        await checkSyncStatusNow();
        await client.mutate({ mutation: SYNC_EMAILS });
        await client.mutate({ mutation: PROCESS_EMAILS });
        await checkSyncStatusNow();
      } catch (error) {
        console.error("Auto-sync on login failed:", error);
        if (activeToastIdRef.current) {
          toast.error("Sync failed. Try again from Settings.", { id: activeToastIdRef.current });
          activeToastIdRef.current = null;
        } else {
          toast.error("Sync failed. Try again from Settings.");
        }
      } finally {
        isOwnTriggeredRef.current = false;
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, navigate, setUser, setAppStatus, setUserPreferences, setInitialized]);

  return null;
};
