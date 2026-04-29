-- products (fixed list — 6 tomato varieties)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null
);
alter table public.products enable row level security;

-- prices
create table public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  date date not null,
  price_per_kg decimal(10,2) not null,
  unique (product_id, date)
);
alter table public.prices enable row level security;

-- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz default now()
);
alter table public.clients enable row level security;

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references public.clients(id),
  client_name_raw text,
  payment_type text not null check (payment_type in ('cash','card','debt')),
  calculated_total decimal(10,2),
  discount_percent decimal(5,2) default 0,
  manual_total decimal(10,2),
  status text not null check (status in ('paid','debt','partial')) default 'paid',
  notes text
);
alter table public.orders enable row level security;

-- order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  boxes_count int not null,
  weight_kg decimal(10,3) not null,
  price_per_kg decimal(10,2) not null,
  line_total decimal(10,2) generated always as (weight_kg * price_per_kg) stored
);
alter table public.order_items enable row level security;

-- debt_payments
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  amount decimal(10,2) not null,
  paid_at timestamptz default now(),
  payment_type text not null check (payment_type in ('cash','card')),
  notes text
);
alter table public.debt_payments enable row level security;
