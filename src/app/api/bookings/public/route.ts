import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

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
    if (!startDate) return fail("Choose a date for your service.");
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
      (serviceName === "Boarding" || serviceName === "Doggy Day Care") &&
      !String(body.getsAlongWithPets ?? "").trim()
    ) {
      return fail("Tell us how your dog does around other pets.");
    }
    if (serviceName === "Drop-In Visits" && body.medicationRequired && !String(body.medicationInstructions ?? "").trim()) {
      return fail("Please add the medication instructions.");
    }

    let serviceStart: Date;
    let serviceEnd: Date;
    let price: number;
    let option: string;
    let endSummaryDate = endDate;

    if (serviceName === "Boarding") {
      const nights = nightsBetween(startDate, endDate);
      if (!nights) return fail("Boarding checkout must be at least one day after drop-off.");
      serviceStart = makeLocalDate(startDate, "15:00")!;
      serviceEnd = makeLocalDate(endDate, "10:00")!;
      option = body.soloCare ? "Solo care" : "Standard boarding";
      price = (body.soloCare ? 60 : 40) * nights + (body.pickup ? 20 : 0) + (body.dropoff ? 20 : 0);
      endSummaryDate = endDate;
    } else if (serviceName === "House Sitting") {
      const nights = nightsBetween(startDate, endDate);
      if (!nights) return fail("House-sitting checkout must be at least one day after check-in.");
      option = serviceOption === "Dedicated overnight" ? "Dedicated overnight" : "Flexible overnight";
      if (body.extendedMorning && option !== "Flexible overnight") {
        return fail("The two-hour extension is only available with flexible overnight care.");
      }
      serviceStart = makeLocalDate(startDate, option === "Dedicated overnight" ? "22:00" : "20:00")!;
      serviceEnd = makeLocalDate(endDate, body.extendedMorning ? "09:00" : "07:00")!;
      const extension = body.extendedMorning ? 20 : 0;
      price = (option === "Dedicated overnight" ? 100 : 80) * nights + extension;
    } else {
      serviceStart = makeLocalDate(startDate, startTime)!;
      if (!serviceStart || serviceStart <= new Date()) return fail("Choose a future date and time.");

      if (serviceName === "Dog Walking") {
        option = serviceOption === "60 minutes" ? "60 minutes" : "30 minutes";
        serviceEnd = new Date(serviceStart.getTime() + (option === "60 minutes" ? 60 : 30) * 60000);
        price = option === "60 minutes" ? 50 : 30;
      } else if (serviceName === "Drop-In Visits") {
        option = serviceOption === "45 minutes" ? "45 minutes" : "30 minutes";
        serviceEnd = new Date(serviceStart.getTime() + (option === "45 minutes" ? 45 : 30) * 60000);
        price = option === "45 minutes" ? 40 : 30;
      } else {
        if (!/^07:(30|45)$|^08:00$/.test(startTime)) {
          return fail("Day-care drop-off is available between 7:30 AM and 8:00 AM.");
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime > "17:00" || endTime < "08:00") {
          return fail("Day-care pickup must be between 8:00 AM and 5:00 PM.");
        }
        option = "Group care — $35/day";
        serviceEnd = makeLocalDate(startDate, endTime)!;
        if (!serviceEnd || serviceEnd <= serviceStart) return fail("Choose an end time after the day-care start time.");
        price = 35;
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

    const summary = [
      `Pet: ${petName} (${petSpecies})${String(body.breed ?? "").trim() ? `, ${String(body.breed).trim()}` : ""}.`,
      petNotes ? `Pet care information: ${petNotes}` : "",
      body.getsAlongWithPets ? `Gets along with other pets: ${body.getsAlongWithPets}` : "",
      body.notes?.trim(),
      serviceAddress ? `Service / transport address: ${serviceAddress}` : "",
      serviceName === "Boarding" ? `Solo care: ${body.soloCare ? "yes" : "no"}. Pickup: ${body.pickup ? "yes" : "no"}. Drop-off: ${body.dropoff ? "yes" : "no"}.` : "",
      serviceName === "Doggy Day Care" ? "Day-care setting: supervised group care with other dogs." : "",
      body.medicationRequired ? `Medication instructions: ${String(body.medicationInstructions ?? "").trim()}` : "",
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
        medication_fee: body.medicationRequired && serviceName === "Drop-In Visits" ? 5 : 0,
        discount_amount: 0,
        estimated_total: price + (body.medicationRequired && serviceName === "Drop-In Visits" ? 5 : 0),
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
      serviceAddress ? `Service / transport address: ${serviceAddress}` : "",
      serviceName === "Boarding" ? `Solo care: ${body.soloCare ? "yes" : "no"}; pickup: ${body.pickup ? "yes" : "no"}; drop-off: ${body.dropoff ? "yes" : "no"}.` : "",
      serviceName === "Doggy Day Care" ? "Day-care setting: supervised group care with other dogs. Compatibility must be reviewed before approval." : "",
    ].filter(Boolean).join("\n");
    const { error: itemError } = await admin.from("booking_services").insert({
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

    return NextResponse.json({ success: true, bookingId, serviceName, endDate: endSummaryDate });
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
