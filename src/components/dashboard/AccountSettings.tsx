import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, AlertTriangle, ExternalLink } from "lucide-react";

export default function AccountSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { body: {} });
      if (error) throw error;
      toast.success("Account deleted. Goodbye!");
      await signOut();
      navigate("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", { body: {} });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error("Unable to open billing portal. Contact support@rickyai.com");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-1">Account Settings</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Billing */}
      <section className="rounded-xl border border-border p-6 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Billing & Subscription</h3>
        <p className="text-sm text-muted-foreground">
          Manage your plan, update payment details, or cancel your subscription through the Stripe customer portal.
        </p>
        <Button variant="outline" onClick={handleManageBilling} className="gap-2">
          <ExternalLink className="w-4 h-4" />
          Manage Billing
        </Button>
      </section>

      {/* Privacy */}
      <section className="rounded-xl border border-border p-6 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Privacy &amp; Data</h3>
        <p className="text-sm text-muted-foreground">
          To request a copy of your data or exercise other privacy rights, email{" "}
          <a href="mailto:privacy@rickyai.com" className="text-primary hover:underline">
            privacy@rickyai.com
          </a>{" "}
          with the subject line "Privacy Request."
        </p>
      </section>

      {/* Delete account */}
      <section className="rounded-xl border border-destructive/30 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">Delete Account</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently deletes your account, all businesses, contacts, videos, and data. This cannot be undone.
          Any active subscriptions will be cancelled immediately.
        </p>
        {!showConfirm ? (
          <Button variant="destructive" onClick={() => setShowConfirm(true)} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Delete My Account
          </Button>
        ) : (
          <div className="space-y-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <p className="text-sm font-medium text-foreground">
              Type <span className="font-mono font-bold">DELETE</span> to confirm permanent deletion:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-destructive/50"
            />
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE" || deleting}
                className="gap-2"
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </Button>
              <Button variant="outline" onClick={() => { setShowConfirm(false); setConfirmText(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
