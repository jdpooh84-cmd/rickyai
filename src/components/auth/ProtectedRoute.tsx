import { ReactNode, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, subscription } = useAuth();
  const hasRenderedOnce = useRef(false);

  // Only show spinner on initial load, not on subscription re-checks
  const isInitialLoad = loading || (!hasRenderedOnce.current && subscription.loading);

  if (isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-hero animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading RickyAI...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Mark that we've rendered children at least once
  hasRenderedOnce.current = true;

  return <>{children}</>;
};

export default ProtectedRoute;