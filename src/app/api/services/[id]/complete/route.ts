
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/emails";
import { sendSms } from "@/lib/sms";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ServiceItem = {
  id: string;
  service_name: string;
  service_option: string;
  price: number;
  pet_name: string | null;
  completed_at: string | null;
};

function money(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    let latePickupFee = 0;
    let serviceItemId: string | null = null;
    let reportLatePickup = false;
    try {
      const body = (await request.json()) as {
        latePickupFee?: unknown;
        serviceItemId?: unknown;
        reportLatePickup?: unknown;
      };
      serviceItemId = typeof body.serviceItemId === "string" ? body.serviceItemId : null;
      reportLatePickup = body.reportLatePickup === true;
      if (body.latePickupFee === 10 || body.latePickupFee === 40 || body.latePickupFee === 55 || body.latePickupFee === 90) {
        latePickupFee = body.latePickupFee;
      } else if (body.latePickupFee !== undefined && body.latePickupFee !== 0) {
        return NextResponse.json(
          { success: false, message: "Choose a valid late-pickup or daytime boarding fee." },
          { status: 400 }
        );
      }
    } catch {
      // Older callers without a JSON body complete the job without extra fees.
    }

    // 1. Verify the signed-in user using their session.
    const sessionClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await sessionClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Please sign in first." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await sessionClient
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      !["employee", "admin"].includes(profile.role)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not authorized to complete jobs.",
        },
        { status: 403 }
      );
    }

    // Only use the service-role client after verifying the user.
    const admin = createSupabaseAdmin();
    const { id: bookingId } = await params;

    // 2. Load the booking.
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, customer_id, guest_name, guest_email, guest_phone, notification_preference, sms_consent, assigned_employee_id, service_name, status, estimated_subtotal, medication_fee, vet_transport_fee, vet_transport_trips, discount_amount, estimated_total, late_pickup_review_required"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      console.error("Booking lookup failed:", bookingError.message);
      return NextResponse.json(
        { success: false, message: "Could not load this booking." },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "Booking not found." },
        { status: 404 }
      );
    }

    // 3. Employees can only complete their own assigned bookings.
    if (
      profile.role === "employee" &&
      booking.assigned_employee_id !== user.id
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This job is not assigned to you.",
        },
        { status: 403 }
      );
    }

    if (reportLatePickup) {
      if (booking.service_name !== "Doggy Day Care") {
        return NextResponse.json(
          { success: false, message: "Late-pickup review alerts only apply to day-care bookings." },
          { status: 400 }
        );
      }
      if (booking.status !== "approved") {
        return NextResponse.json(
          { success: false, message: "Only an active approved job can be flagged." },
          { status: 409 }
        );
      }
      if (booking.late_pickup_review_required) {
        return NextResponse.json({
          success: true,
          message: "This late pickup is already flagged for admin review.",
        });
      }

      const { error: alertError } = await admin
        .from("bookings")
        .update({
          late_pickup_review_required: true,
          late_pickup_reported_at: new Date().toISOString(),
        })
        .eq("id", booking.id);

      if (alertError) {
        console.error("Late-pickup review flag failed:", alertError.message);
        return NextResponse.json(
          { success: false, message: "The admin alert could not be saved." },
          { status: 500 }
        );
      }

      const notificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      if (notificationEmail) {
        const emailResult = await sendEmail({
          to: notificationEmail,
          subject: "Paws in Motion: Late pickup needs invoice review",
          text: [
            "An employee reported a late pickup that needs admin review before invoicing.",
            "",
            `Booking ID: ${booking.id}`,
            `Service: ${booking.service_name || "Pet care service"}`,
            `Customer: ${booking.guest_name || booking.guest_email || "Customer"}`,
            "Open the admin dashboard to review the appropriate fee and create the invoice.",
          ].join("\n"),
        });
        if (!emailResult.success) {
          console.error("Late-pickup admin email failed:", emailResult.error);
        }
      } else {
        console.error("Late-pickup alert saved, but ADMIN_NOTIFICATION_EMAIL is not configured.");
      }

      return NextResponse.json({
        success: true,
        message: "Admin alerted. The booking is flagged for invoice review.",
      });
    }

    // Only approved bookings may be completed.
    if (booking.status !== "approved") {
      return NextResponse.json(
        {
          success: false,
          message:
            booking.status === "completed"
              ? "This booking has already been completed."
              : `This booking cannot be completed because its status is ${booking.status}.`,
        },
        { status: 409 }
      );
    }

    // 4. Load the stored service prices for the invoice.
    const { data: services, error: servicesError } = await admin
      .from("booking_services")
      .select("id, service_name, service_option, price, pet_name, completed_at")
      .eq("booking_id", booking.id)
      .order("service_start", { ascending: true });

    if (servicesError) {
      console.error("Service lookup failed:", servicesError.message);
      return NextResponse.json(
        {
          success: false,
          message: "Could not load the booking's service details.",
        },
        { status: 500 }
      );
    }

    let serviceItems = (services ?? []) as ServiceItem[];

    if (Number(booking.vet_transport_trips ?? 0) > 0) {
      if (!serviceItemId) {
        return NextResponse.json(
          { success: false, message: "Complete each vet transportation leg separately before invoicing." },
          { status: 400 }
        );
      }

      const leg = serviceItems.find((item) => item.id === serviceItemId);
      if (!leg || leg.service_name !== "Vet Transportation") {
        return NextResponse.json(
          { success: false, message: "Choose a scheduled vet transportation leg for completion." },
          { status: 400 }
        );
      }

      if (!leg.completed_at) {
        const { data: markedLeg, error: markError } = await admin
          .from("booking_services")
          .update({ completed_at: new Date().toISOString(), completed_by: user.id })
          .eq("id", serviceItemId)
          .eq("booking_id", booking.id)
          .is("completed_at", null)
          .select("id")
          .maybeSingle();

        if (markError) {
          console.error("Vet leg completion failed:", markError.message);
          return NextResponse.json(
            { success: false, message: "This transportation leg could not be marked complete." },
            { status: 500 }
          );
        }
        if (!markedLeg) {
          return NextResponse.json(
            { success: false, message: "This transportation leg was already completed. Refresh the job." },
            { status: 409 }
          );
        }
      }

      const { data: remainingLegs, error: remainingError } = await admin
        .from("booking_services")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("service_name", "Vet Transportation")
        .is("completed_at", null);

      if (remainingError) {
        console.error("Vet leg status lookup failed:", remainingError.message);
        return NextResponse.json(
          { success: false, message: "Could not verify the remaining transportation legs." },
          { status: 500 }
        );
      }

      if ((remainingLegs ?? []).length > 0) {
        return NextResponse.json({
          success: true,
          invoiceCreated: false,
          message: "This vet trip is complete. The invoice will be created after the remaining trip is complete.",
        });
      }

      await admin
        .from("booking_services")
        .update({ completed_at: new Date().toISOString(), completed_by: user.id })
        .eq("booking_id", booking.id)
        .neq("service_name", "Vet Transportation")
        .is("completed_at", null);

      const { data: refreshedServices, error: refreshedError } = await admin
        .from("booking_services")
        .select("id, service_name, service_option, price, pet_name, completed_at")
        .eq("booking_id", booking.id)
        .order("service_start", { ascending: true });
      if (refreshedError) {
        return NextResponse.json(
          { success: false, message: "Could not reload service details for invoicing." },
          { status: 500 }
        );
      }
      serviceItems = (refreshedServices ?? []) as ServiceItem[];
    }

    const isDayCareBooking = serviceItems.some(
      (item) => item.service_name === "Doggy Day Care"
    );
    const isBoardingBooking = serviceItems.some(
      (item) => item.service_name === "Boarding"
    );
    if ([10, 40, 55].includes(latePickupFee) && !isDayCareBooking) {
      return NextResponse.json(
        { success: false, message: "The late-pickup fee only applies to day-care bookings." },
        { status: 400 }
      );
    }
    if (latePickupFee > 0 && profile.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Only an admin can add a reviewed late-pickup fee to the invoice." },
        { status: 403 }
      );
    }
    if (latePickupFee === 90 && !isBoardingBooking) {
      return NextResponse.json(
        { success: false, message: "The daytime boarding fee only applies to overnight boarding bookings." },
        { status: 400 }
      );
    }

    if (booking.late_pickup_review_required && profile.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "An admin must review the late-pickup fee before the invoice is sent." },
        { status: 403 }
      );
    }

    if (serviceItems.some(
      (item) => !Number.isFinite(Number(item.price)) || Number(item.price) < 0
    )) {
      return NextResponse.json(
        { success: false, message: "A service price is invalid." },
        { status: 400 }
      );
    }

    const medicationFee = Number(booking.medication_fee ?? 0);
    const vetTransportFee = Number(booking.vet_transport_fee ?? 0);
    const vetTransportTrips = Number(booking.vet_transport_trips ?? 0);
    const discountAmount = Number(booking.discount_amount ?? 0);
    const estimatedSubtotal = Number(booking.estimated_subtotal ?? 0);
    const totalAmount = Number(booking.estimated_total ?? 0);

    if (
      ![medicationFee, vetTransportFee, vetTransportTrips, latePickupFee, discountAmount, estimatedSubtotal, totalAmount].every(
        Number.isFinite
      ) ||
      medicationFee < 0 ||
      vetTransportFee < 0 ||
      ![0, 1, 2].includes(vetTransportTrips) ||
      discountAmount < 0 ||
      estimatedSubtotal < 0 ||
      totalAmount < 0
    ) {
      return NextResponse.json(
        { success: false, message: "The booking totals are invalid." },
        { status: 400 }
      );
    }

    const lineItems = serviceItems.filter((item) => item.service_name !== "Vet Transportation").map((item) => ({
      description: `${item.service_name} — ${item.service_option}`,
      quantity: 1,
      unitPrice: Number(item.price),
    }));

    if (medicationFee > 0) {
      lineItems.push({
        description: "Medication fee",
        quantity: 1,
        unitPrice: medicationFee,
      });
    }

    if (vetTransportFee > 0) {
      lineItems.push({
        description: `Vet transportation — ${vetTransportTrips === 1 ? "one way" : "drop off and return"}`,
        quantity: 1,
        unitPrice: vetTransportFee,
      });
    }

    if (latePickupFee > 0) {
      lineItems.push({
        description: latePickupFee === 90
          ? "Daytime boarding fee after overnight stay"
          : latePickupFee === 10 ? "Day-care late-pickup fee" : "Day-care overnight boarding fee",
        quantity: 1,
        unitPrice: latePickupFee,
      });
    }

    // Use the saved booking totals. Do not recalculate historical prices
    // using potentially changed service prices.
    const invoiceSubtotal = Math.round(
      (estimatedSubtotal + medicationFee + latePickupFee) * 100
    ) / 100;

    const invoiceTotal = Math.round((totalAmount + latePickupFee) * 100) / 100;

    if (invoiceTotal > invoiceSubtotal ||
        invoiceTotal < 0 ||
        discountAmount > invoiceSubtotal) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The saved booking totals do not reconcile. Please review the booking before invoicing.",
        },
        { status: 400 }
      );
    }

    // 5. Load the customer email address.
    const { data: customer, error: customerError } = booking.customer_id
      ? await admin
          .from("profiles")
          .select("email, full_name, phone")
          .eq("id", booking.customer_id)
          .maybeSingle()
      : { data: null, error: null };
    const customerEmail = customer?.email?.trim() || booking.guest_email?.trim();
    const customerPhone = customer?.phone?.trim() || booking.guest_phone?.trim();

    if (
      customerError ||
      !customerEmail
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The customer's email address could not be found.",
        },
        { status: 400 }
      );
    }

    // 6. Create exactly one invoice for this booking.
    // The unique booking_id constraint prevents duplicate invoices.
    const invoiceNumber = `PIM-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${crypto
      .randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        booking_id: booking.id,
        customer_id: booking.customer_id,
        subtotal: invoiceSubtotal,
        discount_amount: discountAmount,
        total_amount: invoiceTotal,
        currency: "usd",
        line_items: lineItems,
        invoice_status: "open",
        payment_status: "unpaid",
      })
      .select("id, invoice_number, total_amount")
      .single();

    if (invoiceError || !invoice) {
      if (invoiceError?.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            message:
              "An invoice already exists for this booking. No duplicate invoice was created.",
          },
          { status: 409 }
        );
      }

      console.error("Invoice creation failed:", invoiceError?.message);

      return NextResponse.json(
        {
          success: false,
          message: "The invoice could not be created.",
        },
        { status: 500 }
      );
    }

    // 7. Mark the booking completed only if it is still approved.
    // This protects against two requests completing the same booking.
    const { data: completedBooking, error: completionError } = await admin
      .from("bookings")
      .update({
        status: "completed",
        late_pickup_review_required: false,
        ...(latePickupFee > 0 ? { estimated_total: invoiceTotal } : {}),
      })
      .eq("id", booking.id)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();

    if (completionError || !completedBooking) {
      // Do not leave an open invoice for a booking that was not completed.
      await admin
        .from("invoices")
        .update({ invoice_status: "void" })
        .eq("id", invoice.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "The booking changed before completion. The invoice was voided; refresh and review the booking.",
        },
        { status: 409 }
      );
    }

    // 8. Email the invoice summary to the customer.
    const customerName = customer?.full_name?.trim() || booking.guest_name?.trim() || "Customer";
    const serviceDescriptions = lineItems
      .map(
        (item) =>
          `- ${item.description}: ${money(item.unitPrice * item.quantity)}`
      )
      .join("\n");

    const emailResult = await sendEmail({
      to: customerEmail,
      subject: `Your Paws in Motion invoice ${invoice.invoice_number}`,
      text: [
        `Hello ${customerName},`,
        "",
        "Your Paws in Motion service has been marked completed.",
        "",
        `Invoice: ${invoice.invoice_number}`,
        `Booking reference: ${booking.id}`,
        "",
        "Services:",
        serviceDescriptions || `- ${booking.service_name}`,
        "",
        `Subtotal including medication and additional boarding or late-pickup fees: ${money(invoiceSubtotal)}`,
        `Discount: -${money(discountAmount)}`,
        `Total due: ${money(invoiceTotal)}`,
        "",
        "Payment processing is not yet enabled. Please contact Paws in Motion for payment instructions.",
        "",
        "Thank you for choosing Paws in Motion!",
      ].join("\n"),
    });

    let smsSent = false;
    if (
      booking.sms_consent &&
      customerPhone &&
      ["text", "both"].includes(booking.notification_preference)
    ) {
      const petName = serviceItems.find((item) => item.pet_name)?.pet_name || "your pet";
      const smsResult = await sendSms(
        customerPhone,
        `Hey! Thank you for letting us take care of ${petName} today. Have a great day—it was a pleasure watching them. — Paws in Motion`
      );
      smsSent = smsResult.success;
      if (!smsResult.success) {
        console.error("Completion text could not be sent:", smsResult.error);
      }
    }

    if (emailResult.success) {
      await admin
        .from("invoices")
        .update({
          invoice_email_sent_at: new Date().toISOString(),
          invoice_email_error: null,
        })
        .eq("id", invoice.id);
    } else {
      await admin
        .from("invoices")
        .update({
          invoice_email_error: emailResult.error,
        })
        .eq("id", invoice.id);
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      totalAmount: invoice.total_amount,
      emailSent: emailResult.success,
      smsSent,
      message: emailResult.success
        ? "Job completed, invoice created, and customer email sent."
        : "Job completed and invoice created, but the email could not be sent. Check the server email settings and invoice record.",
    });
  } catch (error) {
    console.error(
      "Service completion failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while completing this job.",
      },
      { status: 500 }
    );
  }
}
