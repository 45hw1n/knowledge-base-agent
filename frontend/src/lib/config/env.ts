export interface AppEnv {
  type: "development" | "production" | string;
  apiUrl: string;
  isLocal: boolean;
}

export const ENV: AppEnv = {
  type: import.meta.env.MODE,
  apiUrl: import.meta.env.VITE_API_URL,
  isLocal: import.meta.env.DEV,
};