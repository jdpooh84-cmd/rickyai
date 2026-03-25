import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/dashboard/AppSidebar";
import StrategySummary from "@/components/dashboard/StrategySummary";
import RickyHelper from "@/components/dashboard/RickyHelper";
import ConnectStep from "@/components/dashboard/ConnectStep";
import ProfileStep from "@/components/dashboard/ProfileStep";
import CompeteStep from "@/components/dashboard/steps/CompeteStep";
import ScoutStep from "@/components/dashboard/steps/ScoutStep";
import AuditStep from "@/components/dashboard/steps/AuditStep";
import PlatformStep from "@/components/dashboard/steps/PlatformStep";
import ScriptStep from "@/components/dashboard/steps/ScriptStep";
import VideoStudioStep from "@/components/dashboard/steps/VideoStudioStep";
import StoryboardStep from "@/components/dashboard/steps/StoryboardStep";
import ExportStep from "@/components/dashboard/steps/ExportStep";
import LeadScoutStep from "@/components/dashboard/steps/LeadScoutStep";
import GrantSearchStep from "@/components/dashboard/steps/GrantSearchStep";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessData } from "@/hooks/useBusinessData";
import { ChevronDown, LogOut, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const stepTitles: Record<number, string> = {
  1: "Connect", 2: "Profile", 3: "Compete", 4: "Scout", 5: "Audit",
  6: "Platform", 7: "Script", 8: "Video Studio", 9: "Storyboard",
  10: "Export", 11: "Lead Scout", 12: "Grant Search",
};

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const { businesses, locations, selectedBusiness, selectedLocation, selectBusiness, setSelectedLocation, loading: bizLoading } = useBusinessData();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const markComplete = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
    if (step < 12) setActiveStep(step + 1);
  };

  const activeBiz = businesses.find(b => b.id === selectedBusiness);
  const activeLoc = locations.find(l => l.id === selectedLocation);

  const renderStep = () => {
    switch (activeStep) {
      case 1: return <ConnectStep onComplete={() => markComplete(1)} />;
      case 2: return <ProfileStep onComplete={() => markComplete(2)} />;
      case 3: return <CompeteStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(3)} />;
      case 4: return <ScoutStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(4)} />;
      case 5: return <AuditStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(5)} />;
      case 6: return <PlatformStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(6)} />;
      case 7: return <ScriptStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(7)} />;
      case 8: return <VideoStudioStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(8)} />;
      case 9: return <StoryboardStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(9)} />;
      case 10: return <ExportStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(10)} />;
      case 11: return <LeadScoutStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(11)} />;
      case 12: return <GrantSearchStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(12)} />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeStep={activeStep} completedSteps={completedSteps} onStepClick={setActiveStep} />

        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-6 w-px bg-border" />

              {/* Business Selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowBizDropdown(!showBizDropdown); setShowLocDropdown(false); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {activeBiz?.business_name || "Select Business"} <ChevronDown className="w-3 h-3" />
                </button>
                {showBizDropdown && businesses.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-card z-50 py-1">
                    {businesses.map(b => (
                      <button
                        key={b.id}
                        onClick={() => { selectBusiness(b.id); setShowBizDropdown(false); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 flex items-center justify-between"
                      >
                        <span className="text-foreground">{b.business_name}</span>
                        {b.id === selectedBusiness && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-muted-foreground/30">•</span>

              {/* Location Selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowLocDropdown(!showLocDropdown); setShowBizDropdown(false); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {activeLoc ? `${activeLoc.city}${activeLoc.state ? `, ${activeLoc.state}` : ""}` : "Select Location"} <ChevronDown className="w-3 h-3" />
                </button>
                {showLocDropdown && locations.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-card z-50 py-1">
                    {locations.map(l => (
                      <button
                        key={l.id}
                        onClick={() => { setSelectedLocation(l.id); setShowLocDropdown(false); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 flex items-center justify-between"
                      >
                        <span className="text-foreground">{l.city}{l.state ? `, ${l.state}` : ""}</span>
                        {l.id === selectedLocation && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-8" onClick={() => { setShowBizDropdown(false); setShowLocDropdown(false); }}>
              {renderStep()}
            </main>
            <StrategySummary completedSteps={completedSteps} businessName={activeBiz?.business_name} locationName={activeLoc ? `${activeLoc.city}${activeLoc.state ? `, ${activeLoc.state}` : ""}` : undefined} />
          </div>
        </div>

        <RickyHelper currentStep={activeStep} businessId={selectedBusiness} />
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
