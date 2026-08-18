import { Navigate } from "react-router-dom";
import { useAppStore } from "../store/appStore";

export const RootRedirect = () => {
  const { user, initialized } = useAppStore();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/home" replace />;
};
