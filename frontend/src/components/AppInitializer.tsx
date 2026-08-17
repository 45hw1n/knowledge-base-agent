import { useEffect } from "react";
import { useApolloClient } from "@apollo/client";
import {
  GET_CURRENT_USER,
  GET_APP_STATUS,
  GET_USER_PREFERENCES,
} from "../graphql/query/auth/authQueries";
import { useAppStore } from "../store/appStore";
import { useUserPreferencesStore } from "../store/userPreferencesStore";

export const AppInitializer = () => {
  const client = useApolloClient();

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
      } catch (error) {
        console.error("App bootstrap failed:", error);
        setUser(null);
        setAppStatus(null);
        setUserPreferences(null);
        setInitialized(true);
      }
    };

    bootstrap();
  }, [client, setUser, setAppStatus, setUserPreferences, setInitialized]);

  return null;
};
