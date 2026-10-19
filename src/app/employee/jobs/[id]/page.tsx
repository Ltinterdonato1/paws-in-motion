
import Link from "next/link";
import Brand from "@/components/Brand";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import CompleteJobButton from "./CompleteJobButton";

type EmployeeJobPageProps = {
  params: Promise<{ id: string }>;
};

type BookingService = {
  id: string;
  service_name: string;
  service_option: string;
  service_start: string;
  service_end: string;
  price: number;
  service_notes: string | null;
  medication_required: boolean;
  medication_instructions: string | null;
  completed_at: string | null;
};

export default function EmployeeJobPage({
  params,
}: EmployeeJobPageProps) {
  return (
    <Suspense fallback={<JobLoading />}>
      <EmployeeJobContent params={params} />
    </Suspense>
  );
}

function JobLoading() {
  return (
    <main className="min-h-screen bg-[#f8f5ec] px-5 py-10 text-[#193d30] sm:px-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-[#e6e4d9] bg-white p-8 shadow-sm">
        <Brand className="brand" subtitle="EMPLOYEE PORTAL" />
        <h1 className="mt-3 text-3xl font-bold">Loading job details...</h1>
        <p className="mt-2 text-sm text-[#5d6f63]">
          Please wait while we retrieve the job information.
        </p>
      </div>
    </main>
  );
}

async function EmployeeJobContent({
  params,
}: EmployeeJobPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "employee" && user.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, customer_id, guest_name, guest_email, guest_phone, assigned_employee_id, service_name, booking_date, status, request_notes, estimated_subtotal, medication_fee, vet_transport_fee, vet_transport_trips, discount_amount, estimated_total, late_pickup_review_required"
    )
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error("Could not load booking:", bookingError.message);
    throw new Error("Unable to load this job.");
  }

  if (!booking) {
    notFound();
  }

  // Employees can only access jobs assigned to them.
  // Admins can access any booking.
  if (
    user.role === "employee" &&
    booking.assigned_employee_id !== user.id
  ) {
    notFound();
  }

  const { data: services, error: servicesError } = await supabase
    .from("booking_services")
    .select(
      "id, service_name, service_option, service_start, service_end, price, service_notes, medication_required, medication_instructions, completed_at"
    )
    .eq("booking_id", booking.id)
    .order("service_start", { ascending: true });

  if (servicesError) {
    console.error("Could not load booking services:", servicesError.message);
    throw new Error("Unable to load the service details.");
  }

  const money = (amount: number | null) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount ?? 0));

  const dateTime = (value: string) =>
    new Date(value).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <main className="min-h-screen bg-[#f8f5ec] px-5 py-10 text-[#193d30] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/employee/jobs"
          className="text-sm font-medium text-[#315846] hover:underline"
        >
          ← Back to My Jobs
        </Link>

        <header className="mb-8 mt-5">
          <Brand className="brand" subtitle="EMPLOYEE PORTAL" />

          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Job Details
          </h1>

          <p className="mt-2 break-all text-sm text-[#5d6f63]">
            Booking reference: {booking.id}
          </p>
        </header>

        <section className="rounded-2xl border border-[#e6e4d9] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">
              {booking.service_name}
            </h2>

            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${
                statusStyles[booking.status] ??
                "bg-gray-100 text-gray-700"
              }`}
            >
              {booking.status}
            </span>
          </div>

          <div className="mt-6 border-t border-[#eeeae0] pt-6">
            <h3 className="font-semibold">Booking Information</h3>

            <p className="mt-2 text-sm text-[#5d6f63]">
              <strong>Scheduled:</strong>{" "}
              {services && services.length > 0
                ? dateTime(services[0].service_start)
                : dateTime(booking.booking_date)}
            </p>

            {(booking.guest_name || booking.guest_email || booking.guest_phone) && (
              <div className="mt-3 text-sm text-[#5d6f63]">
                <p><strong>Customer:</strong> {booking.guest_name || "Customer"}</p>
                {booking.guest_email && <p><strong>Email:</strong> {booking.guest_email}</p>}
                {booking.guest_phone && <p><strong>Phone:</strong> {booking.guest_phone}</p>}
              </div>
            )}

            {booking.request_notes && (
              <div className="mt-4">
                <h3 className="font-semibold">Customer Notes</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#5d6f63]">
                  {booking.request_notes}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e6e4d9] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold">Scheduled Services</h2>

          {!services || services.length === 0 ? (
            <p className="mt-4 text-sm text-[#5d6f63]">
              No individual service details were found for this booking.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#eeeae0]">
              {(services as BookingService[]).map((service) => (
                <article
                  key={service.id}
                  className="py-5 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {service.service_name}
                      </h3>
                      <p className="mt-1 text-sm text-[#5d6f63]">
                        {service.service_option}
                      </p>
                    </div>

                    <p className="font-semibold">
                      {service.service_name === "Vet Transportation" ? "Schedule event" : money(service.price)}
                    </p>
                  </div>

                  <p className="mt-3 text-sm text-[#5d6f63]">
                    <strong>Start:</strong>{" "}
                    {dateTime(service.service_start)}
                  </p>

                  <p className="mt-1 text-sm text-[#5d6f63]">
                    <strong>End:</strong>{" "}
                    {dateTime(service.service_end)}
                  </p>

                  {service.service_notes && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[#5d6f63]">
                      <strong>Service notes:</strong>{" "}
                      {service.service_notes}
                    </p>
                  )}

                  {service.medication_required && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <strong>Medication required</strong>

                      {service.medication_instructions && (
                        <p className="mt-1 whitespace-pre-wrap">
                          {service.medication_instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {service.service_name === "Vet Transportation" && (
                    <div className="mt-4">
                      {service.completed_at ? (
                        <p className="text-sm font-semibold text-green-800">
                          Trip completed · {dateTime(service.completed_at)}
                        </p>
                      ) : booking.status === "approved" ? (
                        <CompleteJobButton
                          bookingId={booking.id}
                          serviceItemId={service.id}
                        />
                      ) : null}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-[#e6e4d9] bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold">Booking Estimate</h2>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[#5d6f63]">Subtotal</span>
              <span>{money(booking.estimated_subtotal)}</span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-[#5d6f63]">Medication fee</span>
              <span>{money(booking.medication_fee)}</span>
            </div>

            {Number(booking.vet_transport_fee) > 0 && <div className="flex justify-between gap-4">
              <span className="text-[#5d6f63]">Vet transportation ({Number(booking.vet_transport_trips) === 1 ? "one way" : "return trip"})</span>
              <span>{money(booking.vet_transport_fee)}</span>
            </div>}

            <div className="flex justify-between gap-4">
              <span className="text-[#5d6f63]">Discount</span>
              <span>-{money(booking.discount_amount)}</span>
            </div>

            <div className="flex justify-between gap-4 border-t border-[#eeeae0] pt-4 text-base font-bold">
              <span>Estimated total</span>
              <span>{money(booking.estimated_total)}</span>
            </div>
          </div>

          <p className="mt-4 text-xs text-[#718477]">
            This is the booking estimate, not a payment confirmation.
          </p>
        </section>

        <div className="mt-6">
          {booking.status === "approved" ? (
            <div className="rounded-xl border border-[#d8e3d7] bg-white p-5">
              <h2 className="font-semibold">Ready for completion</h2>

              <p className="mb-4 mt-2 text-sm text-[#5d6f63]">
                {booking.late_pickup_review_required
                  ? "Late pickup was reported. An admin will review any applicable fee and send the invoice."
                  : Number(booking.vet_transport_trips) > 0
                  ? "Mark each vet trip complete. The customer receives one invoice after the final trip."
                  : "Once the service has been performed, complete the job below to create the customer invoice."}
              </p>

              {!booking.late_pickup_review_required && Number(booking.vet_transport_trips) === 0 && (
                <CompleteJobButton
                  bookingId={booking.id}
                  isDayCare={user.role === "admin" && booking.service_name === "Doggy Day Care"}
                  isBoarding={user.role === "admin" && booking.service_name === "Boarding"}
                  allowLatePickupReport={user.role === "employee" && booking.service_name === "Doggy Day Care"}
                />
              )}
            </div>
          ) : booking.status === "completed" ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-900">
              <h2 className="font-semibold">
                This job is completed
              </h2>
              <p className="mt-2 text-sm">
                The booking is marked as completed.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white p-5 text-sm text-[#5d6f63]">
              Jobs must be approved before they can be completed.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
