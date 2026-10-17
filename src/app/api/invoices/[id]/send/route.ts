
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Invoice sending is not configured yet. An invoice database and email delivery setup are required.",
    },
    { status: 501 }
  );
}
