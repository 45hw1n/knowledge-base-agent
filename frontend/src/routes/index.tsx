import { Route, Routes } from "react-router-dom";
import { AppInitializer } from "@/components/AppInitializer";
import { ManualIngestionPoller } from "@/components/ManualIngestionPoller";
import AppLayout from "@/layouts/AppLayout";
import ConversationsPage from "@/pages/ConversationsPage";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import SettingsPage from "@/pages/SettingsPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import { ProtectedRoute } from "@/router/ProtectedRoute";
import { PublicRoute } from "@/router/PublicRoute";
import { RootRedirect } from "@/router/RootRedirect";

export function AppRoutes() {
  return (
    <>
      <AppInitializer />
      <ManualIngestionPoller />
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/ask-cortex" element={<ConversationsPage />} />
            <Route path="/ask-cortex/:conversationId" element={<ConversationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </>
  );
}
