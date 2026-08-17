import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export const OnboardedRoute = () => {
  const { appStatus } = useAppStore();

  if (!appStatus?.onboarded) {
    return <Navigate to="/onboard" replace />;
  }

  return <Outlet />;
};
