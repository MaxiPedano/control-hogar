-- ============================================================
-- Control Hogar - Esquema de base de datos
-- Pegar completo en: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('EXPENSE', 'INCOME')),
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create unique index if not exists categories_name_unique on public.categories (lower(name));

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('INCOME', 'EXPENSE')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  date date not null,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists transactions_date_idx on public.transactions (date);
create index if not exists transactions_category_idx on public.transactions (category_id);

create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  hours numeric(5,2) not null check (hours > 0),
  hourly_rate numeric(12,2),
  description text,
  created_at timestamptz not null default now()
);

create index if not exists work_entries_date_idx on public.work_entries (entry_date);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (category_id, year, month)
);

create index if not exists budgets_period_idx on public.budgets (year, month);

-- RLS activado SIN politicas publicas:
-- nadie accede con la anon key; solo el servidor usa la service_role key.
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.work_entries enable row level security;
alter table public.budgets enable row level security;
