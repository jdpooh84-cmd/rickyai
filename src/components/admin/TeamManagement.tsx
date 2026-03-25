import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", color: "bg-red-500/20 text-red-400" },
  { value: "developer", label: "Developer", color: "bg-blue-500/20 text-blue-400" },
  { value: "finance", label: "Finance", color: "bg-green-500/20 text-green-400" },
  { value: "marketing", label: "Marketing", color: "bg-purple-500/20 text-purple-400" },
  { value: "moderator", label: "Moderator", color: "bg-yellow-500/20 text-yellow-400" },
];

const TeamManagement = ({ currentUserId }: { currentUserId: string }) => {
  const [searchEmail, setSearchEmail] = useState("");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("developer");

  const handleSearchUsers = async () => {
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "search", email: searchEmail },
      });
      if (error) throw error;
      setManagedUsers(data.users || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to search users");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleGrantRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "grant_role", user_id: userId, role },
      });
      if (error) throw error;
      toast.success(`${role} role granted!`);
      handleSearchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to grant role");
    }
  };

  const handleRevokeRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "revoke_role", user_id: userId, role },
      });
      if (error) throw error;
      toast.success(`${role} role revoked!`);
      handleSearchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke role");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    return ROLE_OPTIONS.find(r => r.value === role)?.color || "bg-muted text-muted-foreground";
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Team & Role Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Search by email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchUsers()}
            className="flex-1"
          />
          <Button onClick={handleSearchUsers} disabled={searchLoading} size="sm">
            <Search className="w-4 h-4 mr-1" /> {searchLoading ? "Searching..." : "Search"}
          </Button>
        </div>

        {managedUsers.length > 0 && (
          <div className="space-y-3">
            {managedUsers.map((u) => (
              <div key={u.id} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length > 0 ? u.roles.map(role => (
                      <span key={role} className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(role)}`}>
                        {role}
                      </span>
                    )) : (
                      <span className="text-xs text-muted-foreground italic">no roles</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2 flex-1">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGrantRole(u.id, selectedRole)}
                      disabled={u.roles.includes(selectedRole)}
                      className="h-8 text-xs"
                    >
                      <UserPlus className="w-3 h-3 mr-1" /> Grant
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map(role => (
                      <Button
                        key={role}
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRevokeRole(u.id, role)}
                        disabled={u.id === currentUserId && role === "admin"}
                        className="h-7 text-xs px-2"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> {role}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamManagement;
