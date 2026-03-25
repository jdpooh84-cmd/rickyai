import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Check } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-2">
              We sent a password reset link to <span className="text-foreground font-medium">{email}</span>.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Click the link in the email to set a new password. The link expires in 1 hour.
            </p>
            <div className="space-y-3">
              <Button variant="outline" className="w-full" onClick={() => { setSent(false); setEmail(""); }}>
                <Mail className="w-4 h-4" /> Send again with different email
              </Button>
              <Link to="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">R</span>
          </div>
          <span className="font-display font-bold text-2xl text-foreground">RickyAI</span>
        </div>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold font-display text-foreground text-center mb-2">Forgot your password?</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Enter your email and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
            )}

            <Button variant="hero" className="w-full" size="lg" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            <Link to="/login" className="text-primary hover:underline font-medium flex items-center justify-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
