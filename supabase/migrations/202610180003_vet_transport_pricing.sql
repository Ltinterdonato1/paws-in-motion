alter table public.bookings
  add column if not exists vet_transport_fee numeric(10, 2) not null default 0,
  add column if not exists vet_transport_trips integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_vet_transport_fee_nonnegative'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_vet_transport_fee_nonnegative
      check (vet_transport_fee >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_vet_transport_trips_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_vet_transport_trips_check
      check (vet_transport_trips in (0, 1, 2));
  end if;
end $$;

create or replace function public.recalculate_booking_discount_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_booking_id uuid;
  booking_customer_id uuid;
  booking_guest_email text;
  booking_medication_fee numeric(10, 2);
  booking_vet_transport_fee numeric(10, 2);
  service_subtotal numeric(10, 2);
  multi_pet_discount numeric(10, 2);
  loyalty_discount numeric(10, 2);
  prior_booking_count integer;
begin
  if tg_op = 'DELETE' then
    target_booking_id := old.booking_id;
  else
    target_booking_id := new.booking_id;
  end if;

  select customer_id, guest_email, coalesce(medication_fee, 0), coalesce(vet_transport_fee, 0)
    into booking_customer_id, booking_guest_email, booking_medication_fee, booking_vet_transport_fee
  from public.bookings
  where id = target_booking_id;

  if not found then
    return null;
  end if;

  select coalesce(sum(price), 0)::numeric(10, 2)
    into service_subtotal
  from public.booking_services
  where booking_id = target_booking_id;

  select coalesce(sum(pet_total * case pet_rank
    when 2 then 0.10
    when 3 then 0.15
    else 0
  end), 0)::numeric(10, 2)
    into multi_pet_discount
  from (
    select
      pet.id,
      sum(service.price) as pet_total,
      (select count(*) + 1
       from public.pets earlier_pet
       where earlier_pet.owner_id = pet.owner_id
         and (
           earlier_pet.created_at < pet.created_at
           or (earlier_pet.created_at = pet.created_at and earlier_pet.id < pet.id)
         )) as pet_rank
    from public.booking_services service
    join public.pets pet on pet.id = service.pet_id
    where service.booking_id = target_booking_id
    group by pet.id, pet.owner_id, pet.created_at
  ) pet_totals;

  select count(*)::integer
    into prior_booking_count
  from public.bookings prior_booking
  where prior_booking.id <> target_booking_id
    and lower(coalesce(prior_booking.status, '')) not in ('cancelled', 'canceled', 'rejected', 'declined')
    and (
      (booking_customer_id is not null and prior_booking.customer_id = booking_customer_id)
      or (
        booking_guest_email is not null
        and lower(prior_booking.guest_email) = lower(booking_guest_email)
      )
    );

  loyalty_discount := case
    when prior_booking_count = 1 then round(service_subtotal * 0.10, 2)
    else 0
  end;

  update public.bookings
  set estimated_subtotal = service_subtotal + booking_vet_transport_fee,
      discount_amount = multi_pet_discount + loyalty_discount,
      estimated_total = greatest(
        0,
        service_subtotal + booking_vet_transport_fee + booking_medication_fee - multi_pet_discount - loyalty_discount
      )
  where id = target_booking_id;

  return null;
end;
$$;
