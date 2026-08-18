import { Route, Routes } from "react-router-dom";
import { AppInitializer } from "@/components/AppInitializer";
import AppLayout from "@/layouts/AppLayout";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import OnboardPage from "@/pages/OnboardPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import SettingsPage from "@/pages/SettingsPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import { OnboardedRoute } from "@/router/OnboardedRoute";
import { OnboardRoute } from "@/router/OnboardRoute";
import { ProtectedRoute } from "@/router/ProtectedRoute";
import { PublicRoute } from "@/router/PublicRoute";
import { RootRedirect } from "@/router/RootRedirect";

export function AppRoutes() {
  return (
    <>
      <AppInitializer />
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<OnboardRoute />}>
            <Route path="/onboard" element={<OnboardPage />} />
          </Route>

          <Route element={<OnboardedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  );
}
