import { useEffect, useState } from "react";
import {
  Link, UserCircle, BarChart3, Search, ClipboardCheck, Monitor,
  FileText, Video, LayoutGrid, Upload, Users, DollarSign, Check,
  Trophy, MessageSquare, ShoppingBag, Eye, ShieldCheck, Zap, Play, Key, Building2, Compass, TrendingUp
} from "lucide-react";
import { getLayersForStep, LAYER_META } from "@/lib/optimizationLayers";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import UsageDashboard from "./UsageDashboard";

const phases = [
  {
    label: "Setup",
    steps: [
      { num: 1, icon: Link, title: "Connect" },
      { num: 2, icon: UserCircle, title: "Profile" },
    ],
  },
  {
    label: "Research",
    steps: [
      { num: 3, icon: BarChart3, title: "Compete" },
      { num: 4, icon: Search, title: "Scout" },
      { num: 5, icon: ClipboardCheck, title: "Audit" },
      { num: 6, icon: Monitor, title: "Platform" },
    ],
  },
  {
    label: "Create",
    steps: [
      { num: 7, icon: FileText, title: "Script" },
      { num: 8, icon: Video, title: "Video Studio" },
      { num: 9, icon: LayoutGrid, title: "Storyboard" },
      { num: 10, icon: Upload, title: "Export" },
    ],
  },
  {
    label: "Grow",
    steps: [
      { num: 11, icon: Users, title: "Lead Scout" },
      { num: 12, icon: DollarSign, title: "Grant Search" },
      { num: 13, icon: Eye, title: "Search Visibility" },
      { num: 14, icon: Zap, title: "Campaign Blueprint" },
    ],
  },
  {
    label: "Optimize",
    steps: [
      { num: 15, icon: ShieldCheck, title: "Omni Optimize" },
    ],
  },
];

const extras = [
  { id: "performance", icon: TrendingUp, title: "Performance" },
  { id: "watch", icon: Play, title: "Watch Videos" },
  { id: "ready", icon: Check, title: "Ready to Post" },
  { id: "connect-tools", icon: Key, title: "Connect Tools" },
  { id: "federal-contracting", icon: Building2, title: "Grant: Fed Contracts" },
  { id: "grant-intel", icon: Compass, title: "Grant: Intel Pack" },
  { id: "score", icon: Trophy, title: "Growth Score" },
  { id: "community", icon: MessageSquare, title: "Community" },
  { id: "marketplace", icon: ShoppingBag, title: "Marketplace" },
];

interface AppSidebarProps {
  activeStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
  activeSection?: string;
  onSectionClick?: (section: string) => void;
}

const AppSidebar = ({ activeStep, completedSteps, onStepClick, activeSection, onSectionClick }: AppSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        <button onClick={() => navigate("/")} className="px-4 mb-6 flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-foreground">R</span>
          </div>
          {!collapsed && <span className="font-display font-bold text-foreground">RickyAI</span>}
        </button>

        {/* Phases */}
        {phases.map(phase => (
          <SidebarGroup key={phase.label}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60">
              {!collapsed && phase.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {phase.steps.map((step) => {
                  const isActive = !activeSection && step.num === activeStep;
                  const isCompleted = completedSteps.includes(step.num);
                  return (
                    <SidebarMenuItem key={step.num}>
                      <SidebarMenuButton
                        onClick={() => { onSectionClick?.(""); onStepClick?.(step.num); }}
                        className={`relative transition-all cursor-pointer ${
                          isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="relative flex-shrink-0">
                            {isCompleted ? (
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-primary" />
                              </div>
                            ) : (
                              <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                                isActive ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground/50"
                              }`}>{step.num}</div>
                            )}
                          </div>
                          {!collapsed && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <step.icon className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm font-medium truncate">{step.title}</span>
                              <div className="flex gap-0.5 ml-auto flex-shrink-0">
                                {getLayersForStep(step.num).slice(0, 2).map(l => (
                                  <span key={l} className={`text-[8px] font-bold px-1 py-0 rounded ${LAYER_META[l].color}`}>{l}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Extras */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60">
            {!collapsed && "Your Content"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {extras.map(item => {
                const isActive = activeSection === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onSectionClick?.(item.id)}
                      className={`cursor-pointer transition-all ${isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
                        {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupContent>
              <UsageDashboard />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60">
              {!collapsed && "Admin"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => navigate("/admin")}
                    className="cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <ShieldCheck className="w-5 h-5 flex-shrink-0 text-primary" />
                      {!collapsed && <span className="text-sm font-medium">Admin Dashboard</span>}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
