// Stripe product/price mapping
export const PLANS = {
  monthly: {
    name: "Monthly",
    price_id: "price_1TEv26DtqsarQIarsty0zeee",
    product_id: "prod_UDLjx27JyqGUjK",
    price: "$79",
    period: "/mo",
    desc: "Full access, cancel anytime",
  },
  annual: {
    name: "Annual",
    price_id: "price_1TEv3cDtqsarQIar4LwOEBnF",
    product_id: "prod_UDLlJvulD7Uwtl",
    price: "$59",
    period: "/mo",
    desc: "Billed $708/year — save $240",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}
