alter table public.booking_services
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.profiles(id) on delete set null;

alter table public.bookings
  add column if not exists late_pickup_review_required boolean not null default false,
  add column if not exists late_pickup_reported_at timestamptz;
