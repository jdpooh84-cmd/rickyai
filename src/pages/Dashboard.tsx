import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import SearchVisibilityStep from "@/components/dashboard/steps/SearchVisibilityStep";
import CampaignBlueprintStep from "@/components/dashboard/steps/CampaignBlueprintStep";
import OmniOptimizeStep from "@/components/dashboard/steps/OmniOptimizeStep";
import FederalContractingStep from "@/components/dashboard/steps/FederalContractingStep";
import GrantIntelStep from "@/components/dashboard/steps/GrantIntelStep";
import GrantConsultantStep from "@/components/dashboard/steps/GrantConsultantStep";
import GamificationPanel from "@/components/dashboard/GamificationPanel";
import CommunityForum from "@/components/dashboard/CommunityForum";
import StrategyMarketplace from "@/components/dashboard/StrategyMarketplace";
import ReadyToPost from "@/pages/ReadyToPost";
import CreateVideoFlow from "@/components/dashboard/CreateVideoFlow";
import ExternalAppConnections from "@/components/dashboard/steps/ExternalAppConnections";
import AddOnPaywall from "@/components/dashboard/AddOnPaywall";
import WatchVideo from "@/components/dashboard/WatchVideo";
import PerformanceStep from "@/components/dashboard/steps/PerformanceStep";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessData } from "@/hooks/useBusinessData";
import { ChevronDown, LogOut, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readLocalStorage, writeLocalStorage } from "@/lib/persistence";

const DASHBOARD_STATE_KEY = "rickyai-dashboard-state";

const Dashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(() => readLocalStorage(DASHBOARD_STATE_KEY, { activeStep: 1, activeSection: "", completedSteps: [] as number[] }).activeStep);
  const [activeSection, setActiveSection] = useState(() => readLocalStorage(DASHBOARD_STATE_KEY, { activeStep: 1, activeSection: "", completedSteps: [] as number[] }).activeSection);
  const [completedSteps, setCompletedSteps] = useState<number[]>(() => readLocalStorage(DASHBOARD_STATE_KEY, { activeStep: 1, activeSection: "", completedSteps: [] as number[] }).completedSteps);
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const { businesses, locations, selectedBusiness, selectedLocation, selectBusiness, setSelectedLocation, refresh: refreshBusinessData } = useBusinessData();

  // Check if first-time user
  useEffect(() => {
    if (!user || onboardingChecked) return;
    const checkOnboarding = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      // Show onboarding if no profile or not completed, AND no businesses exist
      if ((!profile || !profile.onboarding_completed) && businesses.length === 0) {
        setShowOnboarding(true);
      }
      setOnboardingChecked(true);
    };
    checkOnboarding();
  }, [user, onboardingChecked, businesses.length]);

  useEffect(() => {
    writeLocalStorage(DASHBOARD_STATE_KEY, { activeStep, activeSection, completedSteps });
  }, [activeStep, activeSection, completedSteps]);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const handleResetDemo = async () => {
    if (!user) return;
    // Reset onboarding flag
    await supabase.from("profiles").update({ onboarding_completed: false }).eq("user_id", user.id);
    // Delete ALL dependent data in correct order (FK constraints)
    await Promise.all([
      supabase.from("attribution_touchpoints").delete().eq("user_id", user.id),
      supabase.from("content_posts").delete().eq("user_id", user.id),
      supabase.from("video_generation_jobs").delete().eq("user_id", user.id),
      supabase.from("business_media").delete().eq("user_id", user.id),
      supabase.from("campaign_outcomes").delete().eq("user_id", user.id),
      supabase.from("strategy_outputs").delete().eq("user_id", user.id),
    ]);
    // Now safe to delete locations and businesses
    await supabase.from("locations").delete().eq("user_id", user.id);
    await supabase.from("businesses").delete().eq("user_id", user.id);
    // Clear ALL local storage caches (strategy, scripts, video state, etc.)
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith("rickyai-"));
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(DASHBOARD_STATE_KEY);
    // Reset state
    setCompletedSteps([]);
    setActiveStep(1);
    setActiveSection("");
    setOnboardingChecked(false);
    setShowOnboarding(true);
    refreshBusinessData();
    toast.success("Reset complete — starting fresh onboarding!");
  };

  const markComplete = (step: number) => {
    if (!completedSteps.includes(step)) setCompletedSteps(prev => [...prev, step]);
    if (step < 15) setActiveStep(step + 1);
  };

  const activeBiz = businesses.find(b => b.id === selectedBusiness);
  const activeLoc = locations.find(l => l.id === selectedLocation);

  const handleSectionClick = (section: string) => {
    setActiveSection(section);
  };

  const handleStepClick = (step: number) => {
    setActiveSection("");
    setActiveStep(step);
  };

  const handleOnboardingComplete = (businessId: string, locationId: string | null) => {
    setShowOnboarding(false);
    refreshBusinessData();
    // Start at step 1 (Connect) so user walks through the full flow
    setCompletedSteps([]);
    setActiveStep(1);
  };

  const renderContent = () => {
    // Show onboarding for first-time users
    if (showOnboarding) {
      return (
        <CreateVideoFlow
          onComplete={handleOnboardingComplete}
          onSkip={() => {
            setShowOnboarding(false);
            setActiveStep(1);
          }}
        />
      );
    }

    if (activeSection === "score") return <GamificationPanel />;
    if (activeSection === "performance") return <PerformanceStep businessId={selectedBusiness} locationId={selectedLocation} />;
    if (activeSection === "community") return <CommunityForum />;
    if (activeSection === "marketplace") return <StrategyMarketplace />;
    if (activeSection === "ready") return <ReadyToPost />;
    if (activeSection === "watch") return <WatchVideo onBack={() => { setActiveSection(""); setActiveStep(8); }} />;
    if (activeSection === "connect-tools") return <ExternalAppConnections />;
    if (activeSection === "federal-contracting") return <AddOnPaywall addOnKey="federal_contracting"><FederalContractingStep businessId={selectedBusiness} locationId={selectedLocation} /></AddOnPaywall>;
    if (activeSection === "grant-intel") return <AddOnPaywall addOnKey="grant_intel"><GrantIntelStep businessId={selectedBusiness} locationId={selectedLocation} /></AddOnPaywall>;
    if (activeSection === "grant-consultant") return <AddOnPaywall addOnKey="grant_intel"><GrantConsultantStep businessId={selectedBusiness} locationId={selectedLocation} /></AddOnPaywall>;

    switch (activeStep) {
      case 1: return <ConnectStep onComplete={() => markComplete(1)} />;
      case 2: return <ProfileStep onComplete={() => { refreshBusinessData(); markComplete(2); }} />;
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
      case 13: return <SearchVisibilityStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(13)} />;
      case 14: return <CampaignBlueprintStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(14)} />;
      case 15: return <OmniOptimizeStep businessId={selectedBusiness} locationId={selectedLocation} onComplete={() => markComplete(15)} />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar activeStep={activeStep} completedSteps={completedSteps} onStepClick={handleStepClick} activeSection={activeSection} onSectionClick={handleSectionClick} />

        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card/50">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="h-6 w-px bg-border" />
              <div className="relative">
                <button onClick={() => { setShowBizDropdown(!showBizDropdown); setShowLocDropdown(false); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {activeBiz?.business_name || "Select Business"} <ChevronDown className="w-3 h-3" />
                </button>
                {showBizDropdown && businesses.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-card z-50 py-1">
                    {businesses.map(b => (
                      <button key={b.id} onClick={() => { selectBusiness(b.id); setShowBizDropdown(false); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 flex items-center justify-between">
                        <span className="text-foreground">{b.business_name}</span>
                        {b.id === selectedBusiness && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-muted-foreground/30">•</span>
              <div className="relative">
                <button onClick={() => { setShowLocDropdown(!showLocDropdown); setShowBizDropdown(false); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {activeLoc ? `${activeLoc.city}${activeLoc.state ? `, ${activeLoc.state}` : ""}` : "Select Location"} <ChevronDown className="w-3 h-3" />
                </button>
                {showLocDropdown && locations.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-card z-50 py-1">
                    {locations.map(l => (
                      <button key={l.id} onClick={() => { setSelectedLocation(l.id); setShowLocDropdown(false); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 flex items-center justify-between">
                        <span className="text-foreground">{l.city}{l.state ? `, ${l.state}` : ""}</span>
                        {l.id === selectedLocation && <Check className="w-3 h-3 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleResetDemo} title="Reset to fresh onboarding" className="text-xs h-7 px-2">
                Reset &amp; Start Fresh
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out"><LogOut className="w-4 h-4" /></Button>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-8" onClick={() => { setShowBizDropdown(false); setShowLocDropdown(false); }}>
              {renderContent()}
            </main>
            {!activeSection && !showOnboarding && (
              <StrategySummary completedSteps={completedSteps} businessName={activeBiz?.business_name}
                locationName={activeLoc ? `${activeLoc.city}${activeLoc.state ? `, ${activeLoc.state}` : ""}` : undefined} />
            )}
          </div>
        </div>

        <RickyHelper currentStep={activeStep} businessId={selectedBusiness} />
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
