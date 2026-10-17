
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/emails";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ServiceItem = {
  service_name: string;
  service_option: string;
  price: number;
};

function money(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export async function POST(
  _request: Request,
  { params }: RouteContext
) {
  try {
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
        "id, customer_id, assigned_employee_id, service_name, status, estimated_subtotal, medication_fee, discount_amount, estimated_total"
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
      .select("service_name, service_option, price")
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

    const serviceItems = (services ?? []) as ServiceItem[];

    if (serviceItems.some(
      (item) => !Number.isFinite(Number(item.price)) || Number(item.price) < 0
    )) {
      return NextResponse.json(
        { success: false, message: "A service price is invalid." },
        { status: 400 }
      );
    }

    const medicationFee = Number(booking.medication_fee ?? 0);
    const discountAmount = Number(booking.discount_amount ?? 0);
    const estimatedSubtotal = Number(booking.estimated_subtotal ?? 0);
    const totalAmount = Number(booking.estimated_total ?? 0);

    if (
      ![medicationFee, discountAmount, estimatedSubtotal, totalAmount].every(
        Number.isFinite
      ) ||
      medicationFee < 0 ||
      discountAmount < 0 ||
      estimatedSubtotal < 0 ||
      totalAmount < 0
    ) {
      return NextResponse.json(
        { success: false, message: "The booking totals are invalid." },
        { status: 400 }
      );
    }

    const lineItems = serviceItems.map((item) => ({
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

    // Use the saved booking totals. Do not recalculate historical prices
    // using potentially changed service prices.
    const invoiceSubtotal = Math.round(
      (estimatedSubtotal + medicationFee) * 100
    ) / 100;

    const invoiceTotal = Math.round(totalAmount * 100) / 100;

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
    const { data: customer, error: customerError } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", booking.customer_id)
      .maybeSingle();

    if (
      customerError ||
      !customer?.email ||
      !customer.email.trim()
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
      .update({ status: "completed" })
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
    const customerName = customer.full_name?.trim() || "Customer";
    const serviceDescriptions = lineItems
      .map(
        (item) =>
          `- ${item.description}: ${money(item.unitPrice * item.quantity)}`
      )
      .join("\n");

    const emailResult = await sendEmail({
      to: customer.email,
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
        `Subtotal including medication fee: ${money(invoiceSubtotal)}`,
        `Discount: -${money(discountAmount)}`,
        `Total due: ${money(invoiceTotal)}`,
        "",
        "Payment processing is not yet enabled. Please contact Paws in Motion for payment instructions.",
        "",
        "Thank you for choosing Paws in Motion!",
      ].join("\n"),
    });

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
