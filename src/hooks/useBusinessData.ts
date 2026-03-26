import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { readLocalStorage, writeLocalStorage } from "@/lib/persistence";

const BUSINESS_SELECTION_KEY = "rickyai-business-selection";

interface Business {
  id: string;
  business_name: string;
  business_category: string | null;
}

interface Location {
  id: string;
  business_id: string;
  location_name: string;
  city: string;
  state: string | null;
  is_primary: boolean;
}

export const useBusinessData = () => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(() => readLocalStorage(BUSINESS_SELECTION_KEY, { businessId: null, locationId: null }).businessId);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(() => readLocalStorage(BUSINESS_SELECTION_KEY, { businessId: null, locationId: null }).locationId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    writeLocalStorage(BUSINESS_SELECTION_KEY, {
      businessId: selectedBusiness,
      locationId: selectedLocation,
    });
  }, [selectedBusiness, selectedLocation]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, business_name, business_category")
        .eq("user_id", user.id)
        .order("created_at");

      if (biz && biz.length > 0) {
        setBusinesses(biz);

        const persisted = readLocalStorage(BUSINESS_SELECTION_KEY, { businessId: null, locationId: null });
        const nextBusinessId = persisted.businessId && biz.some((b) => b.id === persisted.businessId)
          ? persisted.businessId
          : biz[0].id;
        setSelectedBusiness(nextBusinessId);

        const { data: locs } = await supabase
          .from("locations")
          .select("id, business_id, location_name, city, state, is_primary")
          .eq("user_id", user.id)
          .order("created_at");

        if (locs) {
          setLocations(locs);
          const persistedLocationValid = persisted.locationId && locs.some((l) => l.id === persisted.locationId && l.business_id === nextBusinessId);
          const primary = locs.find(l => l.business_id === nextBusinessId && l.is_primary);
          setSelectedLocation(persistedLocationValid ? persisted.locationId : primary?.id || locs.find(l => l.business_id === nextBusinessId)?.id || null);
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const businessLocations = locations.filter(l => l.business_id === selectedBusiness);

  const selectBusiness = (id: string) => {
    setSelectedBusiness(id);
    const primary = locations.find(l => l.business_id === id && l.is_primary);
    setSelectedLocation(primary?.id || locations.find(l => l.business_id === id)?.id || null);
  };

  const refresh = async () => {
    if (!user) return;
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, business_name, business_category")
      .eq("user_id", user.id)
      .order("created_at");

    if (biz && biz.length > 0) {
      setBusinesses(biz);
      if (!selectedBusiness || !biz.find(b => b.id === selectedBusiness)) {
        setSelectedBusiness(biz[0].id);
      }

      const { data: locs } = await supabase
        .from("locations")
        .select("id, business_id, location_name, city, state, is_primary")
        .eq("user_id", user.id)
        .order("created_at");

      if (locs) {
        setLocations(locs);
        const currentBizId = selectedBusiness || biz[0].id;
        if (!selectedLocation || !locs.find(l => l.id === selectedLocation)) {
          const primary = locs.find(l => l.business_id === currentBizId && l.is_primary);
          setSelectedLocation(primary?.id || locs.find(l => l.business_id === currentBizId)?.id || null);
        }
      }
    }
  };

  return {
    businesses,
    locations: businessLocations,
    selectedBusiness,
    selectedLocation,
    selectBusiness,
    setSelectedLocation,
    loading,
    refresh,
  };
};
