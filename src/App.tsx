import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import TermsAcceptanceGate from "@/components/auth/TermsAcceptanceGate";
import BanCheck from "@/components/auth/BanCheck";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import TermsOfService from "./pages/TermsOfService.tsx";
import InstallApp from "./pages/InstallApp.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/terms" element={<TermsOfService />} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
