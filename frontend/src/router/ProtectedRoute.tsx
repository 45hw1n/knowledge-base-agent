import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export const ProtectedRoute = () => {
  const { user, initialized } = useAppStore();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
