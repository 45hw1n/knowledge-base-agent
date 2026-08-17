import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { getPostAuthPath } from "../utils/postAuthPath";

export const OnboardRoute = () => {
  const { appStatus } = useAppStore();

  if (appStatus?.onboarded) {
    return <Navigate to={getPostAuthPath(appStatus)} replace />;
  }

  return <Outlet />;
};
