
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/emails";

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please sign in to cancel a booking." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice("Bearer ".length);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      return NextResponse.json(
        { error: "Authentication is not configured." },
        { status: 500 }
      );
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const bookingId =
      typeof body?.bookingId === "string" ? body.bookingId.trim() : "";

    if (!bookingId) {
      return NextResponse.json(
        { error: "A booking ID is required." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdmin();

    // Verify the booking belongs to the signed-in customer.
    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .select("id, customer_id, service_name, booking_date, status")
      .eq("id", bookingId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (bookingError) {
      console.error("Booking lookup failed:", bookingError.message);

      return NextResponse.json(
        { error: "We couldn't verify this booking. Please try again." },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: "We couldn't find that booking in your account." },
        { status: 404 }
      );
    }

    if (!["pending", "approved"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Only pending or approved bookings can be cancelled." },
        { status: 409 }
      );
    }

    // Update only if the booking is still cancellable.
    const { data: updatedBooking, error: updateError } = await admin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("customer_id", user.id)
      .in("status", ["pending", "approved"])
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      console.error("Booking cancellation failed:", updateError.message);

      return NextResponse.json(
        { error: "We couldn't cancel your booking. Please try again." },
        { status: 500 }
      );
    }

    if (!updatedBooking) {
      return NextResponse.json(
        {
          error:
            "This booking has already changed. Refresh your dashboard and try again.",
        },
        { status: 409 }
      );
    }

    // Send an admin notification after the cancellation succeeds.
    const notificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

    if (!notificationEmail) {
      console.error(
        "Booking cancelled, but ADMIN_NOTIFICATION_EMAIL is not configured."
      );
    } else {
      const bookingDate = booking.booking_date
        ? new Date(booking.booking_date).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "Not provided";

      const emailResult = await sendEmail({
        to: notificationEmail,
        subject: "Paws in Motion: Booking Cancelled",
        text: [
          "A customer has cancelled a booking.",
          "",
          `Booking ID: ${booking.id}`,
          `Service: ${booking.service_name || "Not provided"}`,
          `Booking date: ${bookingDate}`,
          `Customer email: ${user.email || "Not provided"}`,
          `New status: ${updatedBooking.status}`,
        ].join("\n"),
      });

      if (!emailResult.success) {
        // Do not undo a successful cancellation if email delivery fails.
        console.error(
          "Booking cancelled, but the admin notification email failed:",
          emailResult.error
        );
      }
    }

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: "Your booking has been cancelled.",
    });
  } catch (error) {
    console.error("Unexpected cancellation error:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
