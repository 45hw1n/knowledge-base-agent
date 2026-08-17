type AppStatus = {
  onboarded?: boolean;
} | null;

export function getPostAuthPath(appStatus: AppStatus): string {
  return appStatus?.onboarded ? "/home" : "/onboard";
}
