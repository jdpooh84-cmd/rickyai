-- Milestone 12: EasyStart onboarding flag on businesses
alter table businesses add column if not exists easystart_completed boolean default false;
alter table businesses add column if not exists easystart_step int default 0;
