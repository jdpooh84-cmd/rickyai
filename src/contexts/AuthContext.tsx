import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPlanByProductId, getAddOnByProductId, PlanKey, AddOnKey } from "@/lib/stripe";

interface SubscriptionState {
  subscribed: boolean;
  plan: PlanKey | null;
  subscriptionEnd: string | null;
  trialActive: boolean;
  trialEndsAt: string | null;
  activeAddOns: AddOnKey[];
  loading: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionState;
  hasAccess: boolean;
  checkSubscription: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    subscribed: false,
    plan: null,
    subscriptionEnd: null,
    trialActive: false,
    trialEndsAt: null,
    activeAddOns: [],
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    setSubscription(prev => ({ ...prev, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      const addOnProductIds: string[] = data.addon_product_ids || [];
      const activeAddOns = addOnProductIds
        .map((pid: string) => getAddOnByProductId(pid))
        .filter((k: AddOnKey | null): k is AddOnKey => k !== null);
      setSubscription({
        subscribed: data.subscribed,
        plan: data.product_id ? getPlanByProductId(data.product_id) : null,
        subscriptionEnd: data.subscription_end,
        trialActive: data.trial_active ?? false,
        trialEndsAt: data.trial_ends_at ?? null,
        activeAddOns,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setSubscription(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const hasAccess = subscription.subscribed || subscription.trialActive;

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => checkSubscription(), 0);
      } else {
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkSubscription();
      } else {
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    });

    return () => authSub.unsubscribe();
  }, [checkSubscription]);

  // Periodic refresh every 60s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSubscription({ subscribed: false, plan: null, subscriptionEnd: null, trialActive: false, trialEndsAt: null, activeAddOns: [], loading: false });
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, subscription, hasAccess, checkSubscription, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
