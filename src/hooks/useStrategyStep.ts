import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useStrategyStep = (step: number) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (businessId: string, locationId: string | null) => {
    if (!businessId) {
      toast.error("Please set up your business profile first (Step 2)");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("ai-strategy", {
        body: { step, businessId, locationId },
      });

      if (response.error) throw new Error(response.error.message);

      setData(response.data);
      toast.success("Analysis complete!");
      return response.data;
    } catch (err: any) {
      const msg = err.message || "Failed to generate. Try again.";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadExisting = async (businessId: string) => {
    try {
      const { data: existing } = await supabase
        .from("strategy_outputs")
        .select("output_data")
        .eq("business_id", businessId)
        .eq("step_number", step)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setData(existing.output_data);
      }
    } catch {}
  };

  return { data, loading, error, generate, loadExisting, setData };
};
