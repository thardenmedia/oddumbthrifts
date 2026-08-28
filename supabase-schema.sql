-- Oddumbthrifts Tracker — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query → Run)

-- Items: one row per thing you thrift, whether it's still listed or already sold
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'Other',
  platform text not null default 'Depop',
  date_acquired date,
  cost numeric(10,2) not null default 0,
  date_listed date not null default current_date,
  status text not null default 'Listed' check (status in ('Listed', 'Sold')),
  date_sold date,
  sale_price numeric(10,2),
  platform_fee numeric(10,2) default 0,
  shipping_cost numeric(10,2) default 0,
  created_at timestamptz not null default now()
);

-- Expenses: business costs that aren't tied to one specific item
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  category text not null default 'Other',
  description text,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Row Level Security: each user only ever sees their own rows
alter table items enable row level security;
alter table expenses enable row level security;

create policy "Users manage their own items"
  on items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own expenses"
  on expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Helpful indexes for the dashboard's date filtering
create index if not exists items_user_status_idx on items (user_id, status);
create index if not exists items_user_date_sold_idx on items (user_id, date_sold);
create index if not exists expenses_user_date_idx on expenses (user_id, date);
