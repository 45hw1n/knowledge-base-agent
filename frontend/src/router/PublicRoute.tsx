import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../store/appStore";
import { getPostAuthPath } from "../utils/postAuthPath";

export const PublicRoute = () => {
  const { user, appStatus, initialized } = useAppStore();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <Navigate to={getPostAuthPath(appStatus)} replace />;
  }

  return <Outlet />;
};
