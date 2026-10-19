import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { calculateVetTransportSchedule, type VetTransportSchedule } from "@/lib/vet-transport";

type PublicRequest = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  createAccount?: boolean;
  notificationPreference?: string;
  smsConsent?: boolean;
  petName?: string;
  petId?: string;
  species?: string;
  breed?: string;
  petNotes?: string;
  serviceAddress?: string;
  serviceName?: string;
  serviceOption?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  medicationRequired?: boolean;
  medicationInstructions?: string;
  vetTransportRequired?: boolean;
  vetTransportDetails?: string;
  vetTransportTrips?: number;
  vetDestinationAddress?: string;
  vetAppointmentAt?: string;
  vetReturnPickupAt?: string;
  pickup?: boolean;
  dropoff?: boolean;
  soloCare?: boolean;
  extendedMorning?: boolean;
  getsAlongWithPets?: string;
  notes?: string;
};

const VALID_SERVICES = [
  "Boarding",
  "Dog Walking",
  "Drop-In Visits",
  "Doggy Day Care",
  "House Sitting",
  "Vet Transportation",
] as const;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function makeLocalDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const offsetAt = (timestamp: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)) - timestamp;
  };
  const timestamp = localAsUtc - offsetAt(localAsUtc);
  const check = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  if (
    Number(check.year) !== year || Number(check.month) !== month ||
    Number(check.day) !== day || Number(check.hour) !== hour ||
    Number(check.minute) !== minute
  ) return null;
  return new Date(timestamp);
}

function nightsBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Number.isFinite(nights) && nights > 0 ? nights : null;
}

export async function POST(request: NextRequest) {
  let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
  let accountId: string | null = null;
  let createdNewAccount = false;
  let createdNewPet = false;
  let petId: string | null = null;
  let bookingId: string | null = null;

  try {
    const body = (await request.json()) as PublicRequest;
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");
    const createAccount = Boolean(body.createAccount);
    const notificationPreference = String(body.notificationPreference ?? "email");
    const smsConsent = Boolean(body.smsConsent);
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const petName = String(body.petName ?? "").trim();
    const species = String(body.species ?? "").trim();
    const serviceName = String(body.serviceName ?? "");
    const vetTransportRequested = Boolean(body.vetTransportRequired) || serviceName === "Vet Transportation";
    const serviceAddress = String(body.serviceAddress ?? "").trim();
    const serviceOption = String(body.serviceOption ?? "");
    const startDate = String(body.startDate ?? "");
    const endDate = String(body.endDate ?? startDate);
    const startTime = String(body.startTime ?? "09:00");
    const endTime = String(body.endTime ?? "10:00");

    if (!fullName || !email || !phone || !petName || !species) {
      return fail("Please complete your contact and pet information.");
    }
    if (fullName.length > 120 || email.length > 254 || phone.length > 40 || petName.length > 80) {
      return fail("One or more fields are too long.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("Enter a valid email address.");
    }
    if (!token && createAccount && (password.length < 8 || password.length > 128)) {
      return fail("Your password must be between 8 and 128 characters.");
    }
    if (!["email", "text", "both"].includes(notificationPreference)) {
      return fail("Choose how you want to receive appointment reminders.");
    }
    if (notificationPreference !== "email" && !smsConsent) {
      return fail("Please agree to receive appointment reminder texts, or choose email reminders.");
    }
    if (!(VALID_SERVICES as readonly string[]).includes(serviceName)) {
      return fail("Choose a service from the list.");
    }
    if (!startDate && serviceName !== "Vet Transportation") return fail("Choose a date for your service.");
    if (
      serviceName !== "Doggy Day Care" &&
      serviceName !== "Boarding" &&
      !serviceAddress
    ) {
      return fail("Add the address where we’ll meet your pet.");
    }
    if (serviceName === "Boarding" && (body.pickup || body.dropoff) && !serviceAddress) {
      return fail("Add the address for boarding pickup or drop-off.");
    }
    if (vetTransportRequested && !serviceAddress) {
      return fail("Add your home address for vet transportation pickup.");
    }

    const petSpecies = species.toLowerCase();
    if (petSpecies !== "dog" && petSpecies !== "cat") {
      return fail("Choose dog or cat for your pet.");
    }
    if (
      (serviceName === "Dog Walking" || serviceName === "Boarding" || serviceName === "Doggy Day Care") &&
      petSpecies !== "dog"
    ) {
      return fail(`${serviceName} is currently available for dogs only.`);
    }
    if (
      (serviceName === "Boarding" || (serviceName === "Doggy Day Care" && !body.soloCare)) &&
      !String(body.getsAlongWithPets ?? "").trim()
    ) {
      return fail("Tell us how your dog does around other pets.");
    }
    if (serviceName === "Drop-In Visits" && body.medicationRequired && !String(body.medicationInstructions ?? "").trim()) {
      return fail("Please add the medication instructions.");
    }
    const vetTransportTrips = vetTransportRequested ? Number(body.vetTransportTrips) : 0;
    if (vetTransportRequested && ![1, 2].includes(vetTransportTrips)) {
      return fail("Choose one-way or round-trip vet transportation.");
    }
    if (vetTransportRequested && (!String(body.vetDestinationAddress ?? "").trim() || !String(body.vetAppointmentAt ?? "").trim())) {
      return fail("Add the vet address and appointment date and time.");
    }
    if (vetTransportRequested && vetTransportTrips === 2 && !String(body.vetReturnPickupAt ?? "").trim()) {
      return fail("Choose when your pet will be ready for pickup at the vet.");
    }
    let vetTransportSchedule: VetTransportSchedule | null = null;
    if (vetTransportRequested) {
      try {
        vetTransportSchedule = await calculateVetTransportSchedule({
          pickupAddress: serviceAddress,
          vetAddress: String(body.vetDestinationAddress),
          appointmentAt: String(body.vetAppointmentAt),
          returnPickupAt: vetTransportTrips === 2 ? String(body.vetReturnPickupAt) : null,
        });
      } catch (scheduleError) {
        const message = scheduleError instanceof Error ? scheduleError.message : "We couldn’t calculate the vet route.";
        return fail(message, message.includes("not set up yet") ? 503 : 400);
      }
    }

    let serviceStart: Date;
    let serviceEnd: Date;
    let price: number;
    let option: string;
    let endSummaryDate = endDate;
    const vetTransportFee = vetTransportTrips * 35;

    if (serviceName === "Vet Transportation") {
      if (!vetTransportSchedule) return fail("Calculate the vet transportation schedule before submitting.");
      serviceStart = new Date(vetTransportSchedule.pickupAt);
      serviceEnd = new Date(vetTransportSchedule.appointmentAt);
      option = vetTransportTrips === 1 ? "One-way vet transportation" : "Round-trip vet transportation";
      price = 0;
      endSummaryDate = new Date(vetTransportSchedule.appointmentAt).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    } else if (serviceName === "Boarding") {
      const nights = nightsBetween(startDate, endDate);
      if (!nights) return fail("Boarding checkout must be at least one day after drop-off.");
      const isValidBoardingPickupTime = (time: string) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && time >= "07:00" && time <= "18:00";
      const isValidBoardingDropoffTime = startTime === "20:00";
      if (!isValidBoardingDropoffTime || !isValidBoardingPickupTime(endTime)) {
        return fail("Boarding drop-off is at 8:00 PM. Pickup must be between 7:00 AM and 6:00 PM; pickups after 8:00 AM require team confirmation for any daytime boarding charge.");
      }
      serviceStart = makeLocalDate(startDate, startTime)!;
      serviceEnd = makeLocalDate(endDate, endTime)!;
      option = body.soloCare ? "Solo care" : "Standard boarding";
      price = (body.soloCare ? 55 : 40) * nights + (body.pickup ? 20 : 0) + (body.dropoff ? 20 : 0);
      endSummaryDate = endDate;
    } else if (serviceName === "House Sitting") {
      const nights = nightsBetween(startDate, endDate);
      if (!nights) return fail("House-sitting checkout must be at least one day after check-in.");
      option = "Overnight care";
      serviceStart = makeLocalDate(startDate, "22:00")!;
      serviceEnd = makeLocalDate(endDate, body.extendedMorning ? "09:00" : "07:00")!;
      const extension = body.extendedMorning ? 20 : 0;
      price = 90 * nights + extension;
    } else {
      serviceStart = makeLocalDate(startDate, startTime)!;
      if (!serviceStart || serviceStart <= new Date()) return fail("Choose a future date and time.");

      if (serviceName === "Dog Walking") {
        option = serviceOption === "60 minutes" ? "60 minutes" : "30 minutes";
        serviceEnd = new Date(serviceStart.getTime() + (option === "60 minutes" ? 60 : 30) * 60000);
        price = option === "60 minutes" ? 45 : 25;
      } else if (serviceName === "Drop-In Visits") {
        option = serviceOption === "45 minutes" ? "45 minutes" : "30 minutes";
        serviceEnd = new Date(serviceStart.getTime() + (option === "45 minutes" ? 45 : 30) * 60000);
        price = option === "45 minutes" ? 35 : 30;
      } else {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || startTime < "07:00" || startTime > "18:00") {
          return fail("Day-care drop-off is available from 7:00 AM through 6:00 PM.");
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime > "19:00" || endTime < "07:30") {
          return fail("Day-care pickup must be between 7:30 AM and 7:00 PM.");
        }
        option = body.soloCare ? "One-on-one day care at a caregiver’s home — $90/day" : "Group day care — $45/day";
        serviceEnd = makeLocalDate(startDate, endTime)!;
        if (!serviceEnd || serviceEnd <= serviceStart) return fail("Choose an end time after the day-care start time.");
        price = body.soloCare ? 90 : 45;
      }
      endSummaryDate = startDate;
    }

    if (
      !(serviceStart instanceof Date) ||
      !(serviceEnd instanceof Date) ||
      Number.isNaN(serviceStart.getTime()) ||
      Number.isNaN(serviceEnd.getTime())
    ) {
      return fail("Please check the service dates and times.");
    }
    if (serviceStart <= new Date()) return fail("Choose a future date and time.");

    admin = createSupabaseAdmin();
    if (token) {
      const { data: authData, error: authError } = await admin.auth.getUser(token);
      if (authError || !authData.user) return fail("Please sign in again to submit your booking.", 401);
      accountId = authData.user.id;
      const { data: profile } = await admin.from("profiles").select("role").eq("id", accountId).maybeSingle();
      if (profile?.role !== "customer") return fail("Only customer accounts can submit bookings.", 403);
    } else if (createAccount) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
      if (createError || !created.user) {
        return fail(createError?.message ?? "We couldn't create your account.");
      }
      accountId = created.user.id;
      createdNewAccount = true;

      const { error: profileError } = await admin.from("profiles").upsert({
        id: accountId,
        email,
        full_name: fullName,
        phone,
        role: "customer",
      });
      if (profileError) throw profileError;
    }

    const petNotes = [body.petNotes]
      .filter(Boolean)
      .join("\n");
    if (body.petId && token) {
      const { data: savedPet, error: savedPetError } = await admin
        .from("pets")
        .select("id, species")
        .eq("id", body.petId)
        .eq("owner_id", accountId)
        .maybeSingle();
      if (savedPetError || !savedPet) return fail("We couldn't find that pet in your account.");
      if ((savedPet.species ?? "").toLowerCase() !== petSpecies) {
        return fail("The selected pet’s type changed. Refresh and choose the service again.");
      }
      petId = savedPet.id;
    } else if (accountId) {
      const { data: pet, error: petError } = await admin
        .from("pets")
        .insert({
          owner_id: accountId,
          name: petName,
          species: petSpecies,
          breed: String(body.breed ?? "").trim() || null,
          notes: petNotes || null,
          photo_path: null,
        })
        .select("id")
        .single();
      if (petError || !pet) throw petError ?? new Error("Unable to save pet details.");
      petId = pet.id;
      createdNewPet = true;
    }

    let petDiscountRate = 0;
    if (accountId && petId) {
      const { data: householdPets, error: householdPetsError } = await admin
        .from("pets")
        .select("id")
        .eq("owner_id", accountId)
        .order("created_at", { ascending: true });
      if (householdPetsError) throw householdPetsError;
      const petRank = (householdPets ?? []).findIndex((pet) => pet.id === petId) + 1;
      if (petRank === 2) petDiscountRate = 10;
      if (petRank === 3) petDiscountRate = 15;
    }

    const priorBookingQueries = [];
    if (accountId) {
      priorBookingQueries.push(
        admin.from("bookings").select("id, status").eq("customer_id", accountId)
      );
    }
    priorBookingQueries.push(
      admin.from("bookings").select("id, status").eq("guest_email", email)
    );
    const priorBookingResults = await Promise.all(priorBookingQueries);
    const priorBookings = new Map<string, string>();
    for (const result of priorBookingResults) {
      if (result.error) throw result.error;
      for (const priorBooking of result.data ?? []) {
        priorBookings.set(priorBooking.id, String(priorBooking.status ?? ""));
      }
    }
    const validPriorBookings = [...priorBookings.values()].filter((status) =>
      !["cancelled", "canceled", "rejected", "declined"].includes(status.toLowerCase())
    );
    const loyaltyDiscountRate = validPriorBookings.length === 1 ? 10 : 0;
    const discountRate = petDiscountRate + loyaltyDiscountRate;
    const discountAmount = Math.round(price * discountRate) / 100;
    const medicationFee = body.medicationRequired && serviceName === "Drop-In Visits" ? 5 : 0;
    const estimatedTotal = Math.max(0, price + medicationFee + vetTransportFee - discountAmount);

    const summary = [
      `Pet: ${petName} (${petSpecies})${String(body.breed ?? "").trim() ? `, ${String(body.breed).trim()}` : ""}.`,
      petNotes ? `Pet care information: ${petNotes}` : "",
      body.getsAlongWithPets ? `Gets along with other pets: ${body.getsAlongWithPets}` : "",
      body.notes?.trim(),
      vetTransportRequested && vetTransportSchedule ? `Vet transportation: ${vetTransportTrips === 1 ? "one way ($35)" : "drop-off and return ($35 each way)"}. Home pickup: ${new Date(vetTransportSchedule.pickupAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; vet appointment: ${new Date(vetTransportSchedule.appointmentAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; route: ${vetTransportSchedule.outboundDistanceMiles} miles, ${vetTransportSchedule.outboundDriveMinutes} minutes plus 10 minutes for traffic variability and 5 minutes for arrival buffer. Vet: ${String(body.vetDestinationAddress).trim()}.${vetTransportSchedule.returnPickupAt ? ` Return pickup: ${new Date(vetTransportSchedule.returnPickupAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; estimated home arrival: ${new Date(vetTransportSchedule.returnArrivalAt!).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} (${vetTransportSchedule.returnDriveMinutes} minutes).` : ""} ${String(body.vetTransportDetails ?? "").trim()}` : "",
      serviceAddress ? `Service / transport address: ${serviceAddress}` : "",
      serviceName === "Boarding" ? `Solo care: ${body.soloCare ? "yes" : "no"}. Pickup: ${body.pickup ? "yes" : "no"}. Drop-off: ${body.dropoff ? "yes" : "no"}.` : "",
      serviceName === "Boarding" && endTime > "08:00" ? "Requested pickup is after 8:00 AM; confirm any daytime boarding charge with the customer before approval." : "",
      serviceName === "Doggy Day Care" ? `Day-care setting: ${body.soloCare ? "daytime boarding, one-on-one care at a caregiver’s home" : "supervised group care with other dogs"}.` : "",
      body.medicationRequired ? `Medication instructions: ${String(body.medicationInstructions ?? "").trim()}` : "",
      petDiscountRate ? `Multi-pet discount: ${petDiscountRate}% for pet number ${petDiscountRate === 10 ? "two" : "three"}.` : "",
      loyaltyDiscountRate ? "Second-booking loyalty discount: 10%." : "",
    ].filter(Boolean).join("\n");

    const { data: booking, error: bookingError } = await admin
      .from("bookings")
      .insert({
        customer_id: accountId,
        guest_name: fullName,
        guest_email: email,
        guest_phone: phone,
        notification_preference: notificationPreference,
        sms_consent: smsConsent,
        service_name: serviceName,
        booking_date: serviceStart.toISOString(),
        status: "pending",
        request_notes: summary || null,
        estimated_subtotal: price,
        medication_fee: medicationFee,
        vet_transport_fee: vetTransportFee,
        vet_transport_trips: vetTransportTrips,
        discount_amount: discountAmount,
        estimated_total: estimatedTotal,
      })
      .select("id")
      .single();
    if (bookingError || !booking) throw bookingError ?? new Error("Unable to create the booking request.");
    bookingId = booking.id;

    const serviceNotes = [
      `Pet: ${petName} (${petSpecies})${String(body.breed ?? "").trim() ? `, ${String(body.breed).trim()}` : ""}.`,
      petNotes ? `Pet care information: ${petNotes}` : "",
      body.getsAlongWithPets ? `Gets along with other pets: ${body.getsAlongWithPets}` : "",
      body.notes?.trim(),
      vetTransportRequested && vetTransportSchedule ? `Vet transportation: ${vetTransportTrips === 1 ? "one way ($35)" : "drop-off and return ($35 each way)"}. Home pickup: ${new Date(vetTransportSchedule.pickupAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; vet appointment: ${new Date(vetTransportSchedule.appointmentAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; route: ${vetTransportSchedule.outboundDistanceMiles} miles, ${vetTransportSchedule.outboundDriveMinutes} minutes plus 10 minutes for traffic variability and 5 minutes for arrival buffer. Vet: ${String(body.vetDestinationAddress).trim()}.${vetTransportSchedule.returnPickupAt ? ` Return pickup: ${new Date(vetTransportSchedule.returnPickupAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; estimated home arrival: ${new Date(vetTransportSchedule.returnArrivalAt!).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} (${vetTransportSchedule.returnDriveMinutes} minutes).` : ""} ${String(body.vetTransportDetails ?? "").trim()}` : "",
      serviceAddress ? `${serviceName === "Vet Transportation" ? "Home pickup address" : "Service / transport address"}: ${serviceAddress}` : "",
      serviceName === "Boarding" ? `Solo care: ${body.soloCare ? "yes" : "no"}; pickup: ${body.pickup ? "yes" : "no"}; drop-off: ${body.dropoff ? "yes" : "no"}.` : "",
      serviceName === "Doggy Day Care" ? `Day-care setting: ${body.soloCare ? "daytime boarding, one-on-one care at a caregiver’s home" : "supervised group care with other dogs"}.${body.soloCare ? "" : " Compatibility must be reviewed before approval."}` : "",
    ].filter(Boolean).join("\n");
    const { error: itemError } = serviceName === "Vet Transportation" ? { error: null } : await admin.from("booking_services").insert({
      booking_id: bookingId,
      pet_id: petId,
      pet_name: petName,
      pet_species: petSpecies,
      pet_breed: String(body.breed ?? "").trim() || null,
      service_name: serviceName,
      service_option: option,
      service_start: serviceStart.toISOString(),
      service_end: serviceEnd.toISOString(),
      price,
      service_notes: serviceNotes || null,
      medication_required: serviceName === "Drop-In Visits" && Boolean(body.medicationRequired),
      medication_instructions: body.medicationRequired ? String(body.medicationInstructions ?? "").trim() : "",
    });
    if (itemError) throw itemError;

    if (vetTransportSchedule) {
      const pickupNotes = `Pickup address: ${serviceAddress}. Vet address: ${String(body.vetDestinationAddress).trim()}. Appointment: ${new Date(vetTransportSchedule.appointmentAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}. Traffic-aware drive estimate: ${vetTransportSchedule.outboundDriveMinutes} minutes (${vetTransportSchedule.outboundDistanceMiles} miles) plus 10 minutes for traffic variability and 5 minutes for arrival buffer. ${String(body.vetTransportDetails ?? "").trim()}`;
      const transportEvents = [{
        booking_id: bookingId,
        pet_id: petId,
        pet_name: petName,
        pet_species: petSpecies,
        pet_breed: String(body.breed ?? "").trim() || null,
        service_name: "Vet Transportation",
        service_option: `Home pickup ${serviceAddress} → vet drop-off ${String(body.vetDestinationAddress).trim()}`,
        service_start: vetTransportSchedule.pickupAt,
        service_end: vetTransportSchedule.appointmentAt,
        price: 0,
        service_notes: pickupNotes,
        medication_required: false,
        medication_instructions: "",
      }];
      if (vetTransportSchedule.returnPickupAt && vetTransportSchedule.returnArrivalAt) {
        transportEvents.push({
          booking_id: bookingId,
          pet_id: petId,
          pet_name: petName,
          pet_species: petSpecies,
          pet_breed: String(body.breed ?? "").trim() || null,
          service_name: "Vet Transportation",
          service_option: `Vet pickup ${String(body.vetDestinationAddress).trim()} → home ${serviceAddress}`,
          service_start: vetTransportSchedule.returnPickupAt,
          service_end: vetTransportSchedule.returnArrivalAt,
          price: 0,
          service_notes: `Vet address: ${String(body.vetDestinationAddress).trim()}. Home address: ${serviceAddress}. Return drive estimate: ${vetTransportSchedule.returnDriveMinutes} minutes. ${String(body.vetTransportDetails ?? "").trim()}`,
          medication_required: false,
          medication_instructions: "",
        });
      }
      const { error: transportEventsError } = await admin.from("booking_services").insert(transportEvents);
      if (transportEventsError) throw transportEventsError;
    }

    return NextResponse.json({
      success: true,
      bookingId,
      serviceName,
      endDate: endSummaryDate,
      vetTransportSchedule,
      discountAmount,
      estimatedTotal,
    });
  } catch (error) {
    if (admin && bookingId) await admin.from("bookings").delete().eq("id", bookingId);
    if (admin && createdNewPet && petId) {
      await admin.from("pets").delete().eq("id", petId);
    }
    if (admin && accountId && createdNewAccount) {
      await admin.from("profiles").delete().eq("id", accountId);
      await admin.auth.admin.deleteUser(accountId);
    }
    return fail(error instanceof Error ? error.message : "Unable to submit your booking request.", 500);
  }
}
