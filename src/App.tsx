import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import TermsAcceptanceGate from "@/components/auth/TermsAcceptanceGate";
import BanCheck from "@/components/auth/BanCheck";
// Eagerly loaded — small and needed on first paint
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import NotFound from "./pages/NotFound.tsx";
// Lazy loaded — heavy routes that only a fraction of page-loads need
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const TermsOfService = lazy(() => import("./pages/TermsOfService.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const InstallApp = lazy(() => import("./pages/InstallApp.tsx"));
const DemoVideoShowcase = lazy(() => import("./pages/DemoVideoShowcase.tsx"));

const queryClient = new QueryClient();

const App = () => {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/index" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/install" element={<InstallApp />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/app/*"
                element={
                  <ProtectedRoute>
                    <BanCheck>
                      <TermsAcceptanceGate>
                        <Dashboard />
                      </TermsAcceptanceGate>
                    </BanCheck>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <BanCheck>
                      <TermsAcceptanceGate>
                        <AdminDashboard />
                      </TermsAcceptanceGate>
                    </BanCheck>
                  </ProtectedRoute>
                }
              />
              <Route path="/demo/donatos" element={<DemoVideoShowcase />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
