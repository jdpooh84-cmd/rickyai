import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/dashboard/AppSidebar";
import StrategySummary from "@/components/dashboard/StrategySummary";
import RickyHelper from "@/components/dashboard/RickyHelper";
import ConnectStep from "@/components/dashboard/ConnectStep";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeStep={1} completedSteps={[]} />

        <div className="flex-1 flex flex-col">
          {/* Top bar */}
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-6 w-px bg-border" />
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Select Business <ChevronDown className="w-3 h-3" />
              </button>
              <span className="text-muted-foreground/30">•</span>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Select Location <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                No AI Connected
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Main content area */}
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-8">
              <ConnectStep />
            </main>
            <StrategySummary />
          </div>
        </div>

        <RickyHelper />
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
