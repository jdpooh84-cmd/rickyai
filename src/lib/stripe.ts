// Stripe product/price mapping
export const PLANS = {
  monthly: {
    name: "Monthly",
    price_id: "price_1TEySEDtqsarQIarO7vop512",
    product_id: "prod_UDPGYEdFpDRvVC",
    price: "$99",
    period: "/mo",
    desc: "Full 14-step growth system, AI video production, community, and automation",
  },
  annual: {
    name: "Annual",
    price_id: "price_1TEySoDtqsarQIarthDWCVOK",
    product_id: "prod_UDPHH5QTYvPRzQ",
    price: "$79",
    period: "/mo",
    desc: "Billed $948/year — save $240. All features + priority AI",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// Usage bundled allowances per seat per month
export const SEAT_ALLOWANCES = {
  llm_tokens: 500_000,
  render_jobs: 50,
  storage_gb: 10,
} as const;

// Enterprise routing thresholds
export const ENTERPRISE_THRESHOLDS = {
  seats: 10,
  llm_tokens: 5_000_000,
  render_jobs: 500,
  storage_gb: 100,
} as const;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}
