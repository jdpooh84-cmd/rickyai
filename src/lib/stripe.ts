// Stripe product/price mapping
export const PLANS = {
  monthly: {
    name: "Monthly",
    price_id: "price_1TEySEDtqsarQIarO7vop512",
    product_id: "prod_UDPGYEdFpDRvVC",
    price: "$99",
    period: "/mo",
    desc: "Full access with AI video production, cancel anytime",
  },
  annual: {
    name: "Annual",
    price_id: "price_1TEySoDtqsarQIarthDWCVOK",
    product_id: "prod_UDPHH5QTYvPRzQ",
    price: "$79",
    period: "/mo",
    desc: "Billed $948/year — save $240",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}
