import { NextRequest, NextResponse } from "next/server";
import { calculateVetTransportSchedule } from "@/lib/vet-transport";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schedule = await calculateVetTransportSchedule({
      pickupAddress: String(body.pickupAddress ?? ""),
      vetAddress: String(body.vetAddress ?? ""),
      appointmentAt: String(body.appointmentAt ?? ""),
      returnPickupAt: body.returnPickupAt ? String(body.returnPickupAt) : null,
    });
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn’t calculate that route.";
    const status = message.includes("not set up yet") ? 503 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
