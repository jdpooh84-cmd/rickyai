// Stripe product/price mapping — synced with live Stripe catalog
// 5-tier pricing: Creator → Business Starter → Growth → Agency → Enterprise (custom)

export const PLANS = {
  creator: {
    name: "Creator",
    price_id: "price_1TFDVVDtqsarQIarojr8er0y",
    product_id: "prod_UDep9PW3ELRa6K",
    price: "$59",
    period: "/mo",
    desc: "1 brand, 1 location. Basic Video Studio, content calendar, BYOLLM support.",
    max_brands: 1,
    max_locations: 1,
    max_campaigns: 2,
    can_use_grant_search: false,
    can_sell_marketplace: false,
    has_team_collaboration: false,
    steps_available: [1, 2, 6, 7, 8, 9, 10, 13], // Connect, Profile, Platform, Script, Video Studio, Storyboard, Export, Search Visibility
  },
  business: {
    name: "Business Starter",
    price_id: "price_1TFDVqDtqsarQIar3kQWYDP1",
    product_id: "prod_UDepZzB9GKoPnY",
    price: "$169",
    period: "/mo",
    desc: "1 brand, 2 locations. Full 14-step engine, Lead Scout, Campaign Blueprint.",
    max_brands: 1,
    max_locations: 2,
    max_campaigns: 5,
    can_use_grant_search: false,
    can_sell_marketplace: false,
    has_team_collaboration: false,
    steps_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  growth: {
    name: "Growth",
    price_id: "price_1TFDWCDtqsarQIarZHt5lBNQ",
    product_id: "prod_UDepPmrMY3zOEX",
    price: "$249",
    period: "/mo",
    desc: "5 brands, 5 locations each. Full engine, marketplace selling, Grant Search, priority support.",
    max_brands: 5,
    max_locations: 5,
    max_campaigns: 15,
    can_use_grant_search: true,
    can_sell_marketplace: true,
    has_team_collaboration: false,
    steps_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  agency: {
    name: "Agency",
    price_id: "price_1TFDWaDtqsarQIar3nI2BViZ",
    product_id: "prod_UDeqmytH227V3p",
    price: "$799",
    period: "/mo",
    desc: "25+ brands, unlimited locations. Team roles, full marketplace, cross-brand analytics.",
    max_brands: 25,
    max_locations: 99,
    max_campaigns: 99,
    can_use_grant_search: true,
    can_sell_marketplace: true,
    has_team_collaboration: true,
    steps_available: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Enterprise is quote-based, not in Stripe self-serve
export const ENTERPRISE_INFO = {
  name: "Enterprise",
  price: "Custom",
  desc: "Franchises, hospitals, universities, government. SSO, dedicated infrastructure, unlimited brands.",
  min_price: 1500,
  max_price: 5000,
} as const;

// Nonprofit discount: 15% off any tier
export const NONPROFIT_DISCOUNT_PERCENT = 15;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}

export function getPlanConfig(planKey: PlanKey | null) {
  if (!planKey) return null;
  return PLANS[planKey];
}
