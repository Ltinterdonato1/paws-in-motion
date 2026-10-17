
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Stripe webhook processing is not configured. No payment status has been changed.",
    },
    { status: 501 }
  );
}