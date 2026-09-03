# Ricky AI — Entitlement Matrix

Last updated: 2026-09-03

## Plan Step Access

| Step | Name | Creator ($59) | Business ($169) | Growth ($249) | Agency ($799) | Trial |
|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | Connect | ✅ | ✅ | ✅ | ✅ | ✅ |
| 2 | Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3 | Compete | ❌ | ✅ | ✅ | ✅ | ❌ |
| 4 | Scout | ❌ | ✅ | ✅ | ✅ | ❌ |
| 5 | Audit | ❌ | ✅ | ✅ | ✅ | ❌ |
| 6 | Platform | ✅ | ✅ | ✅ | ✅ | ✅ |
| 7 | Script | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | Video Studio | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | Storyboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| 10 | Export | ✅ | ✅ | ✅ | ✅ | ✅ |
| 11 | Lead Scout | ❌ | ✅ | ✅ | ✅ | ❌ |
| 12 | Grant Search | ❌ | ✅ | ✅ | ✅ | ❌ |
| 13 | Search Visibility | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14 | Campaign Blueprint | ❌ | ✅ | ✅ | ✅ | ❌ |
| 15 | Omni Optimize | ❌ | ❌ | ✅ | ✅ | ❌ |

## Add-Ons (require base plan + add-on subscription)

| Add-On | Price | Product ID | Accessed via |
|---|---|---|---|
| Federal Contracting | $50/mo | prod_UEZOQ0OGfVdYPi | Section: federal-contracting |
| Grant Intelligence | $50/mo | prod_UEZOL1ICzSWAnt | Sections: grant-intel, grant-consultant |

Add-ons are enforced by `AddOnPaywall` component wrapping the section content.

## Enforcement Points

1. **Frontend (Dashboard.tsx)** — `gated(stepNum, name, content)` wrapper calls `checkStep()` from `useEntitlement()` hook. Inaccessible steps render `LockedStep` upgrade prompt instead of the step component.

2. **Frontend (AppSidebar)** — Lock icon displayed on step items the user cannot access.

3. **Edge functions** — `ricky-orchestrator` and `workflow-diagnosis` validate subscription before executing AI calls (server-side enforcement).

## Plan Resolution Flow

```
AuthContext.subscription.plan  (PlanKey | null)
  ↓
useEntitlement.checkStep(n)
  ↓ calls
canAccessStep(n, plan, trialActive, addOns)   [src/lib/entitlements.ts]
  ↓ reads
PLANS[plan].steps_available                    [src/lib/stripe.ts]
```

## Admin / Test Bypass

- `product_id: "admin_bypass"` in check-subscription resolves to the Agency plan (all steps).
- `is_test_account: true` in profiles also triggers full access.
- These bypasses exist in `check-subscription` edge function and propagate through `subscription.plan` in AuthContext.

## Price ID Allowlist (create-checkout)

All six Stripe price IDs are server-side allowlisted in `create-checkout/index.ts`. Any price ID not in the list returns HTTP 400 before reaching Stripe.

```
price_1TeGX2RUytwslneZ7OMOagHD  → Creator $59/mo
price_1TeGX2RUytwslneZLs6JpyHL  → Business Starter $169/mo
price_1TeGX1RUytwslneZpYfpkgXd  → Growth $249/mo
price_1TeGX1RUytwslneZCWA5jEqx  → Agency $799/mo
price_1TeGX3RUytwslneZ98JVVxM0  → Federal Contracting add-on $50/mo
price_1TeGX1RUytwslneZ29hrgbs3  → Grant Intelligence add-on $50/mo
```
