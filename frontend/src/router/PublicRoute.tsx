import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export const PublicRoute = () => {
  const { user, initialized } = useAppStore();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};
