-- Add Stripe subscription tracking columns to profiles
-- These fields are written by the stripe-webhook edge function so that
-- subscription state is synced server-side instead of relying solely on
-- the 60-second polling loop in check-subscription.

alter table profiles
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_price_id text,
  add column if not exists payment_failed boolean not null default false;

create index if not exists profiles_stripe_sub_idx on profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;
