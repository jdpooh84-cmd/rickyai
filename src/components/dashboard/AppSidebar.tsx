import {
  Link, UserCircle, BarChart3, Search, ClipboardCheck, Monitor,
  FileText, Video, LayoutGrid, Upload, Users, DollarSign, Check
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const steps = [
  { num: 1, icon: Link, title: "Connect", path: "/app/connect" },
  { num: 2, icon: UserCircle, title: "Profile", path: "/app/profile" },
  { num: 3, icon: BarChart3, title: "Compete", path: "/app/compete" },
  { num: 4, icon: Search, title: "Scout", path: "/app/scout" },
  { num: 5, icon: ClipboardCheck, title: "Audit", path: "/app/audit" },
  { num: 6, icon: Monitor, title: "Platform", path: "/app/platform" },
  { num: 7, icon: FileText, title: "Script", path: "/app/script" },
  { num: 8, icon: Video, title: "Video Studio", path: "/app/video-studio" },
  { num: 9, icon: LayoutGrid, title: "Storyboard", path: "/app/storyboard" },
  { num: 10, icon: Upload, title: "Export", path: "/app/export" },
  { num: 11, icon: Users, title: "Lead Scout", path: "/app/lead-scout" },
  { num: 12, icon: DollarSign, title: "Grant Search", path: "/app/grant-search" },
];

interface AppSidebarProps {
  activeStep: number;
  completedSteps: number[];
}

const AppSidebar = ({ activeStep, completedSteps }: AppSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-4">
        {/* Logo */}
        <div className="px-4 mb-6 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-foreground">P</span>
          </div>
          {!collapsed && <span className="font-display font-bold text-foreground">PulseCore</span>}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60">
            {!collapsed && "Growth Steps"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {steps.map((step) => {
                const isActive = step.num === activeStep;
                const isCompleted = completedSteps.includes(step.num);

                return (
                  <SidebarMenuItem key={step.num}>
                    <SidebarMenuButton
                      className={`relative transition-all ${
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
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
                            }`}>
                              {step.num}
                            </div>
                          )}
                        </div>
                        {!collapsed && (
                          <div className="flex items-center gap-2">
                            <step.icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{step.title}</span>
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
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
