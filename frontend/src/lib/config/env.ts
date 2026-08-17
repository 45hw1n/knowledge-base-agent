export interface AppEnv {
  type: "development" | "production" | string;
  apiUrl: string;
  isLocal: boolean;
  host: string;
}

export const ENV: AppEnv = {
  type: import.meta.env.MODE,
  apiUrl: import.meta.env.VITE_API_URL,
  isLocal: import.meta.env.DEV,
  host: import.meta.env.VITE_HOST
};