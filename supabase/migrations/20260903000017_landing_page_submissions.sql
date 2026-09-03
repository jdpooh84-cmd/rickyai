create table if not exists landing_page_submissions (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid references landing_pages(id) on delete cascade not null,
  name text,
  phone text,
  email text,
  created_at timestamptz default now()
);
alter table landing_page_submissions enable row level security;
create policy "owner_lp_submissions" on landing_page_submissions for all using (
  landing_page_id in (
    select id from landing_pages where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  )
);

-- Atomic counter increment for landing page submissions (avoids read-modify-write race)
create or replace function increment_lp_submissions(page_id uuid)
returns void language sql security definer as $$
  update landing_pages set submissions = submissions + 1 where id = page_id;
$$;
