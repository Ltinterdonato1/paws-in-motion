-- Support booking requests without a customer login, while retaining contact
-- details for admin review, appointment reminders, and invoice delivery.
alter table public.bookings
  alter column customer_id drop not null;

alter table public.bookings
  add column if not exists guest_name text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text,
  add column if not exists notification_preference text not null default 'email',
  add column if not exists sms_consent boolean not null default false;

alter table public.invoices
  alter column customer_id drop not null;

alter table public.booking_services
  alter column pet_id drop not null;

alter table public.booking_services
  add column if not exists pet_name text,
  add column if not exists pet_species text,
  add column if not exists pet_breed text,
  add column if not exists reminder_24h_email_sent_at timestamptz,
  add column if not exists reminder_24h_sms_sent_at timestamptz,
  add column if not exists reminder_2h_email_sent_at timestamptz,
  add column if not exists reminder_2h_sms_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_notification_preference_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_notification_preference_check
      check (notification_preference in ('email', 'text', 'both'));
  end if;
end $$;
