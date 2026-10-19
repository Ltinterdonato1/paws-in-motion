"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Brand from "@/components/Brand";
import { createClient } from "@/lib/supabase";

type ServiceName =
  | "Boarding"
  | "House Sitting"
  | "Drop-In Visits"
  | "Doggy Day Care"
  | "Dog Walking"
  | "Vet Transportation";

const SERVICE_NAMES: ServiceName[] = [
  "Boarding",
  "House Sitting",
  "Drop-In Visits",
  "Doggy Day Care",
  "Dog Walking",
  "Vet Transportation",
];

const SERVICE_LABELS: Record<ServiceName, string> = {
  Boarding: "Boarding at a Caregiver’s Home",
  "House Sitting": "House Sitting",
  "Drop-In Visits": "Drop-In Visits",
  "Doggy Day Care": "Doggy Day Care",
  "Dog Walking": "Dog Walking",
  "Vet Transportation": "Vet Transportation",
};

const initial = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  createAccount: false,
  notificationPreference: "email",
  smsConsent: false,
  petName: "",
  species: "dog",
  breed: "",
  petNotes: "",
  serviceAddress: "",
  serviceName: "Dog Walking" as ServiceName | "",
  serviceOption: "30 minutes",
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "17:00",
  medicationRequired: false,
  medicationInstructions: "",
  vetTransportRequired: false,
  vetTransportDetails: "",
  vetTransportTrips: 1,
  vetDestinationAddress: "",
  vetAppointmentAt: "",
  vetReturnPickupAt: "",
  pickup: false,
  dropoff: false,
  soloCare: false,
  getsAlongWithPets: "",
  extendedMorning: false,
  notes: "",
};

type VetScheduleEstimate = {
  pickupAt: string;
  appointmentAt: string;
  outboundDriveMinutes: number;
  outboundDistanceMiles: number;
  returnPickupAt: string | null;
  returnArrivalAt: string | null;
  returnDriveMinutes: number | null;
};

export default function BookingRequestPage() {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [savedPets, setSavedPets] = useState<Array<{ id: string; name: string; species: string | null; breed: string | null }>>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guestSuccess, setGuestSuccess] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [vetScheduleEstimate, setVetScheduleEstimate] = useState<VetScheduleEstimate | null>(null);
  const [vetScheduleLoading, setVetScheduleLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setCurrentUser({ id: data.user.id, email: data.user.email ?? "" });
      const [{ data: profile }, { data: pets }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", data.user.id).maybeSingle(),
        supabase.from("pets").select("id, name, species, breed").eq("owner_id", data.user.id).order("created_at", { ascending: false }),
      ]);
      setForm((current) => ({
        ...current,
        fullName: profile?.full_name ?? String(data.user.user_metadata?.full_name ?? ""),
        email: data.user.email ?? "",
        phone: profile?.phone ?? String(data.user.user_metadata?.phone ?? ""),
      }));
      setSavedPets(pets ?? []);
    });

    const requested = new URLSearchParams(window.location.search).get("service");
    const requestedSoloCare = new URLSearchParams(window.location.search).get("soloCare") === "1";
    setShowExtras(new URLSearchParams(window.location.search).get("extras") === "1" || requested?.toLowerCase() === "vet transportation");
    const match = SERVICE_NAMES.find(
      (name) => name.toLowerCase() === requested?.toLowerCase()
    );
    if (match) {
      setForm((current) => ({
        ...current,
        serviceName: match,
        vetTransportRequired: match === "Vet Transportation",
        soloCare: match === "Doggy Day Care" && requestedSoloCare,
        serviceOption:
          match === "Boarding" ? "Standard boarding" :
          match === "House Sitting" ? "Overnight care" :
          match === "Drop-In Visits" ? "30 minutes" :
          match === "Doggy Day Care" ? "Group care" : "30 minutes",
        startTime: match === "Doggy Day Care" ? "07:00" : match === "Boarding" ? "20:00" : "09:00",
        endTime: match === "Doggy Day Care" ? "19:00" : match === "Boarding" ? "08:00" : "17:00",
      }));
    } else if (new URLSearchParams(window.location.search).get("extras") === "1") {
      setForm((current) => ({ ...current, serviceName: "" }));
    }
  }, []);

  function set<K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (["serviceAddress", "vetDestinationAddress", "vetAppointmentAt", "vetReturnPickupAt", "vetTransportTrips", "vetTransportRequired"].includes(key)) {
      setVetScheduleEstimate(null);
    }
  }

  function changeService(serviceName: ServiceName | "") {
    if (serviceName === "Vet Transportation") setShowExtras(true);
    setForm((current) => ({
      ...current,
      serviceName,
      vetTransportRequired: serviceName === "Vet Transportation" || (current.vetTransportRequired && current.serviceName !== "Vet Transportation"),
      soloCare: serviceName === current.serviceName ? current.soloCare : false,
      serviceOption:
        serviceName === "Boarding" ? "Standard boarding" :
        serviceName === "House Sitting" ? "Overnight care" :
        serviceName === "Drop-In Visits" ? "30 minutes" :
          serviceName === "Doggy Day Care" ? "Group care" : "30 minutes",
        startTime: serviceName === "Doggy Day Care" ? "07:00" : serviceName === "Boarding" ? "20:00" : current.serviceName === "Doggy Day Care" || current.serviceName === "Boarding" ? "09:00" : current.startTime,
        endTime: serviceName === "Doggy Day Care" ? "19:00" : serviceName === "Boarding" ? "08:00" : current.endTime,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (form.vetTransportRequired && !vetScheduleEstimate) {
      setError("Calculate the vet pickup and return schedule before submitting your request.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUser) {
        const { data: sessionData } = await createClient().auth.getSession();
        if (!sessionData.session?.access_token) {
          throw new Error("Your session expired. Please sign in again before submitting.");
        }
        authHeaders.Authorization = `Bearer ${sessionData.session.access_token}`;
      }
      const response = await fetch("/api/bookings/public", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          ...form,
          vetAppointmentAt: form.vetAppointmentAt ? new Date(form.vetAppointmentAt).toISOString() : "",
          vetReturnPickupAt: form.vetReturnPickupAt ? new Date(form.vetReturnPickupAt).toISOString() : "",
          petId: selectedPetId || undefined,
          notes: `${form.notes}${form.extendedMorning ? "\nTwo-hour morning extension requested, until 9:00 AM (+$20)." : ""}`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We couldn't submit your request.");

      if (!currentUser && form.createAccount) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (signInError) {
          router.replace("/login?next=%2Fdashboard");
          return;
        }
      } else if (!currentUser) {
        setGuestSuccess(result.bookingId);
        return;
      }
      router.replace("/dashboard?booking=requested");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn't submit your request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function calculateVetSchedule() {
    if (!form.serviceAddress.trim() || !form.vetDestinationAddress.trim() || !form.vetAppointmentAt) {
      setError("Enter your home pickup address, vet address, and appointment time first.");
      return;
    }
    if (Number(form.vetTransportTrips) === 2 && !form.vetReturnPickupAt) {
      setError("Choose when your pet will be ready for pickup at the vet.");
      return;
    }

    setVetScheduleLoading(true);
    setError("");
    setVetScheduleEstimate(null);
    try {
      const response = await fetch("/api/vet-transport/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress: form.serviceAddress,
          vetAddress: form.vetDestinationAddress,
          appointmentAt: new Date(form.vetAppointmentAt).toISOString(),
          returnPickupAt: Number(form.vetTransportTrips) === 2
            ? new Date(form.vetReturnPickupAt).toISOString()
            : null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "We couldn’t calculate the route.");
      }
      setVetScheduleEstimate(result.schedule as VetScheduleEstimate);
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "We couldn’t calculate the route.");
    } finally {
      setVetScheduleLoading(false);
    }
  }

  const isOvernight = form.serviceName === "Boarding" || form.serviceName === "House Sitting";
  const isDogOnly = ["Boarding", "Doggy Day Care", "Dog Walking"].includes(form.serviceName);
  const nights = form.startDate && form.endDate
    ? Math.max(0, Math.round((new Date(`${form.endDate}T12:00:00`).getTime() - new Date(`${form.startDate}T12:00:00`).getTime()) / 86400000))
    : 0;
  let estimate = showExtras && !form.serviceName
    ? "Choose a main service to see an estimate"
    : "Confirmed by our team";
  if (form.serviceName === "Boarding" && nights > 0) {
    const nightlyRate = form.soloCare ? 55 : 40;
    estimate = `$${(nights * nightlyRate + (form.pickup ? 20 : 0) + (form.dropoff ? 20 : 0)).toFixed(2)}`;
  } else if (form.serviceName === "House Sitting" && nights > 0) {
    estimate = `$${(nights * 90 + (form.extendedMorning ? 20 : 0)).toFixed(2)}`;
  } else if (form.serviceName === "Dog Walking") {
    estimate = form.serviceOption === "60 minutes" ? "$45.00" : "$25.00";
  } else if (form.serviceName === "Drop-In Visits") {
    estimate = `$${((form.serviceOption === "45 minutes" ? 35 : 30) + (form.medicationRequired ? 5 : 0)).toFixed(2)}`;
  } else if (form.serviceName === "Doggy Day Care") {
    estimate = form.soloCare ? "$90.00 per day" : "$45.00 per day";
  } else if (form.serviceName === "Vet Transportation") {
    estimate = `$${Number(form.vetTransportTrips) * 35}.00`;
  }
  if (form.vetTransportRequired && form.serviceName !== "Vet Transportation") {
    const transportFee = Number(form.vetTransportTrips) * 35;
    const estimateParts = estimate.match(/^\$([\d.]+)(.*)$/);
    if (estimateParts) {
      estimate = `$${(Number(estimateParts[1]) + transportFee).toFixed(2)}${estimateParts[2]}`;
    }
  }

  if (guestSuccess) {
    return (
      <main className="account-page">
        <section className="account-card">
          <Brand className="account-brand" />
          <p className="account-eyebrow">REQUEST RECEIVED</p>
          <h1>We’ll be in touch.</h1>
          <p className="account-description">
            Your booking request is pending admin approval. We’ll send the appointment reminders using your selected contact preference, and email your invoice when the job is complete.
          </p>
          <p className="request-reference">Booking reference: {guestSuccess}</p>
          <p className="account-footer">Want to manage your pet details or request ongoing care? <Link href="/signup">Create an account</Link></p>
          <Link href="/#services" className="account-home-link">Back to services</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page booking-request-page">
      <section className="account-card booking-request-card">
        <Brand className="account-brand" />
        <p className="account-eyebrow">BOOK THOUGHTFUL PET CARE</p>
        <h1>Let’s make a plan.</h1>
        <p className="account-description">
          Share your pet’s details and the care you need. An account is optional; every request is reviewed by our team before it’s confirmed.
        </p>

        <form className="account-form" onSubmit={submit}>
          <h2 className="request-section-title">Choose a service</h2>
          <label htmlFor="serviceName">Service</label>
          <select id="serviceName" required value={form.serviceName} onChange={(e) => changeService(e.target.value as ServiceName | "")}>
            <option value="">Choose the service you’re booking with these extras</option>
            {SERVICE_NAMES.map((name) => <option key={name} value={name}>{SERVICE_LABELS[name]}</option>)}
          </select>

          {form.serviceName === "Boarding" && <>
            <label htmlFor="boardingOption">Boarding style</label>
            <select id="boardingOption" value={form.soloCare ? "Solo care" : "Standard boarding"} onChange={(e) => set("soloCare", e.target.value === "Solo care")}>
              <option value="Standard boarding">Standard boarding — $40/night</option>
              <option value="Solo care">Solo care, no other pets — $55/night</option>
            </select>
            <label className="request-check"><input type="checkbox" checked={form.pickup} onChange={(e) => set("pickup", e.target.checked)} /> Pick up my pet (+$20)</label>
            <label className="request-check"><input type="checkbox" checked={form.dropoff} onChange={(e) => set("dropoff", e.target.checked)} /> Drop off my pet (+$20)</label>
            <p className="request-hint">Boarding is an overnight stay with drop-off at 8:00 PM. Morning pickup is between 7:00 and 8:00 AM, which includes a one-hour grace period. If you need pickup after 8:00 AM, daytime boarding may be needed; we’ll confirm any extra charge with you before approval. Each arranged trip is $20 within our service area; you can also bring your pet to and from the caregiver’s home.</p>
          </>}

          {form.serviceName === "House Sitting" && <>
            <p className="request-hint">Overnight care is from 10:00 PM to 7:00 AM, with a caregiver staying with your pet. For pets who can stay home alone, you can request separate evening and morning drop-in visits instead.</p>
            <label className="request-check"><input type="checkbox" checked={form.extendedMorning} onChange={(e) => set("extendedMorning", e.target.checked)} /> Add a 2-hour morning extension, until 9:00 AM (+$20)</label>
          </>}

          {form.serviceName === "Dog Walking" && <>
            <label htmlFor="walkOption">Walk length</label>
            <select id="walkOption" value={form.serviceOption} onChange={(e) => set("serviceOption", e.target.value)}>
              <option>30 minutes</option><option>60 minutes</option>
            </select>
          </>}

          {form.serviceName === "Drop-In Visits" && <>
            <label htmlFor="dropinOption">Visit length</label>
            <select id="dropinOption" value={form.serviceOption} onChange={(e) => set("serviceOption", e.target.value)}>
              <option>30 minutes</option><option>45 minutes</option>
            </select>
            <label className="request-check"><input type="checkbox" checked={form.medicationRequired} onChange={(e) => set("medicationRequired", e.target.checked)} /> Medication support (+$5)</label>
            {form.medicationRequired && <>
              <label htmlFor="medicationInstructions">Medication instructions</label>
              <textarea id="medicationInstructions" value={form.medicationInstructions} onChange={(e) => set("medicationInstructions", e.target.value)} required />
            </>}
          </>}

          {showExtras && <section className="request-extra-panel" aria-labelledby="request-extras-title">
            <h2 id="request-extras-title" className="request-section-title">{form.serviceName === "Vet Transportation" ? "Vet transportation details" : "Extras & add-ons"}</h2>
            <p className="request-hint">{form.serviceName === "Vet Transportation" ? "Vet transportation can be booked on its own or added to another service." : "Choose a main service above, then select any add-ons you need. Vet transportation can also be booked on its own."}</p>
            {form.serviceName !== "Vet Transportation" && <p className="request-hint">Medication support can be added to a drop-in for $5 per visit. Vet transportation is $35 per one-way trip within 15 miles of your pickup home.</p>}
            {form.serviceName === "Vet Transportation" ? <p className="request-hint"><strong>Service requested:</strong> Vet transportation</p> : <label className="request-check"><input type="checkbox" checked={form.vetTransportRequired} onChange={(e) => set("vetTransportRequired", e.target.checked)} /> I’d like to request transportation to a vet appointment</label>}
            {form.vetTransportRequired && <>
              <label htmlFor="vetTransportTrips">Transportation requested</label>
              <select id="vetTransportTrips" value={form.vetTransportTrips} onChange={(e) => set("vetTransportTrips", Number(e.target.value))}>
                <option value={1}>One way — $35</option>
                <option value={2}>Drop off and return later — $35 per trip</option>
              </select>
              <label htmlFor="vetDestinationAddress">Vet clinic address<input id="vetDestinationAddress" autoComplete="street-address" value={form.vetDestinationAddress} onChange={(e) => set("vetDestinationAddress", e.target.value)} required /></label>
              <label htmlFor="vetAppointmentAt">Vet appointment date and time<input id="vetAppointmentAt" type="datetime-local" value={form.vetAppointmentAt} onChange={(e) => set("vetAppointmentAt", e.target.value)} required /></label>
              {Number(form.vetTransportTrips) === 2 && <label htmlFor="vetReturnPickupAt">When should we pick up your pet from the vet?<input id="vetReturnPickupAt" type="datetime-local" min={form.vetAppointmentAt} value={form.vetReturnPickupAt} onChange={(e) => set("vetReturnPickupAt", e.target.value)} required /></label>}
              <label htmlFor="vetTransportDetails">Transportation notes (optional)<textarea id="vetTransportDetails" value={form.vetTransportDetails} onChange={(e) => set("vetTransportDetails", e.target.value)} placeholder="Clinic contact or anything the caregiver should know" /></label>
              <button type="button" className="vet-transport-calc" onClick={calculateVetSchedule} disabled={vetScheduleLoading}>
                {vetScheduleLoading ? "Calculating drive time…" : "Calculate pickup schedule"}
              </button>
              {vetScheduleEstimate && <div className="request-hint" role="status">
                <strong>Scheduled home pickup:</strong> {new Date(vetScheduleEstimate.pickupAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}<br />
                Estimated drive: {vetScheduleEstimate.outboundDriveMinutes} minutes ({vetScheduleEstimate.outboundDistanceMiles} miles), plus 10 minutes for traffic variability and 5 minutes for arrival buffer.<br />
                {vetScheduleEstimate.returnPickupAt && vetScheduleEstimate.returnArrivalAt && <>Return pickup at the vet: {new Date(vetScheduleEstimate.returnPickupAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}; estimated home arrival: {new Date(vetScheduleEstimate.returnArrivalAt).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles" })} ({vetScheduleEstimate.returnDriveMinutes} minutes).</>}
              </div>}
            </>}
            {form.serviceName !== "Vet Transportation" && <p className="request-hint"><strong>Additional pets:</strong> when saved to your customer account, the second pet gets 10% off and the third gets 15% off the service price. Your second booking also gets 10% off; eligible discounts are applied automatically.</p>}
          </section>}

          {form.serviceName === "Doggy Day Care" && <p className="request-hint">Choose supervised group care with other dogs for $45/day, or one-on-one care for $90/day. Care hours are 7:30 AM–6:00 PM; drop-off is available as early as 7:00 AM, with pickup by 7:00 PM. Pickup from 6:01–7:00 PM adds a $10 late fee. Pickup after 7:00 PM without calling us adds an overnight boarding fee: $40 for the standard rate or $55 for one-on-one care. Dogs requesting group care should be comfortable with other dogs or suitable for a gradual introduction. We’ll review compatibility before approval.</p>}

          {form.serviceName === "Doggy Day Care" && <>
            <label htmlFor="dayCareStyle">Day-care style</label>
            <select id="dayCareStyle" value={form.soloCare ? "solo" : "group"} onChange={(event) => set("soloCare", event.target.value === "solo")}>
              <option value="group">Supervised group care — $45/day</option>
              <option value="solo">One-on-one care at a caregiver’s home — $90/day</option>
            </select>
          </>}

          {form.serviceName !== "Vet Transportation" && <div className="request-fields-two">
            <label> {form.serviceName === "Boarding" ? "Drop-off date" : isOvernight ? "Check-in date" : "Service date"}
              <input type="date" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </label>
            {isOvernight ? <label>{form.serviceName === "Boarding" ? "Pickup date" : "Check-out date"}
              <input type="date" required min={form.startDate} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </label> : form.serviceName === "Doggy Day Care" ? <label>Pick-up time (by 7:00 PM)
              <input type="time" required min="07:30" max="19:00" step={900} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </label> : <label>Start time
              <input type="time" required value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </label>}
          </div>}
          {form.serviceName === "Boarding" && <div className="request-fields-two">
            <p className="request-hint"><strong>Drop-off time:</strong> 8:00 PM</p>
            <label htmlFor="boardingPickupTime">Requested pickup time (7:00 AM–6:00 PM; after 8:00 AM requires team confirmation)
              <input id="boardingPickupTime" type="time" required min="07:00" max="18:00" step={900} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </label>
          </div>}
          {(form.serviceName !== "Doggy Day Care" || form.vetTransportRequired) && <label htmlFor="serviceAddress">
            {form.vetTransportRequired ? "Home address for vet pickup" : form.serviceName === "Boarding" ? "Pickup / drop-off address (if needed)" : "Where should we meet your pet?"}
            <input id="serviceAddress" autoComplete="street-address" required={form.serviceName !== "Boarding" || form.pickup || form.dropoff || form.vetTransportRequired} value={form.serviceAddress} onChange={(e) => set("serviceAddress", e.target.value)} />
          </label>}
          {!isOvernight && form.serviceName === "Doggy Day Care" && <label>Drop-off time (from 7:00 AM; care starts at 7:30 AM)<input type="time" required min="07:00" max="18:00" step={900} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} /></label>}

          <h2 className="request-section-title">Tell us about your pet</h2>
          {currentUser && savedPets.length > 0 && <>
            <label htmlFor="savedPet">Choose a saved pet or add a new one</label>
            <select id="savedPet" value={selectedPetId} onChange={(e) => {
              const pet = savedPets.find((item) => item.id === e.target.value);
              setSelectedPetId(e.target.value);
              if (pet) setForm((current) => ({ ...current, petName: pet.name, species: pet.species?.toLowerCase() || "dog", breed: pet.breed || "" }));
              else setForm((current) => ({ ...current, petName: "", species: "dog", breed: "" }));
            }}>
              <option value="">Add a new pet</option>
              {savedPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
            </select>
          </>}
          <div className="request-fields-two">
            <label htmlFor="petName">Pet’s name<input id="petName" required maxLength={80} value={form.petName} onChange={(e) => set("petName", e.target.value)} /></label>
            <label htmlFor="species">Pet type<select id="species" value={form.species} onChange={(e) => set("species", e.target.value)}><option value="dog">Dog</option><option value="cat">Cat</option></select></label>
          </div>
          {isDogOnly && form.species !== "dog" && <p className="request-hint">This service is currently available for dogs. Choose Drop-In Visits or House Sitting for cats.</p>}
          <label htmlFor="breed">Breed (optional)<input id="breed" value={form.breed} onChange={(e) => set("breed", e.target.value)} /></label>
          {(form.serviceName === "Boarding" || (form.serviceName === "Doggy Day Care" && !form.soloCare)) && <>
            <label htmlFor="compatibility">How does your dog do around other pets?</label>
            <select id="compatibility" required value={form.getsAlongWithPets} onChange={(e) => set("getsAlongWithPets", e.target.value)}>
              <option value="">Choose one</option><option value="Gets along well">Gets along well</option><option value="Needs a slow introduction">Needs a slow introduction</option><option value="Needs to be the only pet">Needs to be the only pet</option><option value="Not sure">Not sure</option>
            </select>
          </>}
          <label htmlFor="petNotes">Care needs, routine, or other helpful details<textarea id="petNotes" value={form.petNotes} onChange={(e) => set("petNotes", e.target.value)} /></label>
          <label htmlFor="notes">Anything else we should know?<textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>

          <h2 className="request-section-title">Your contact details</h2>
          <div className="request-fields-two">
            <label htmlFor="fullName">Your full name<input id="fullName" autoComplete="name" required maxLength={120} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></label>
            <label htmlFor="phone">Phone number<input id="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          </div>
          <label htmlFor="email">Email address<input id="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
          {!currentUser && <>
            <label className="request-check"><input type="checkbox" checked={form.createAccount} onChange={(e) => set("createAccount", e.target.checked)} /> Create a free account to manage your pet information and future bookings (optional)</label>
            {form.createAccount && <label htmlFor="password">Create a password<input id="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} /><small>At least 8 characters. If you already have an account, <Link href={`/login?next=${encodeURIComponent(`/booking-request?service=${encodeURIComponent(form.serviceName)}`)}`}>sign in to request care.</Link></small></label>}
            {!form.createAccount && <small>If you already have an account, <Link href={`/login?next=${encodeURIComponent(`/booking-request?service=${encodeURIComponent(form.serviceName)}`)}`}>sign in to book.</Link></small>}
          </>}

          <label htmlFor="notificationPreference">Appointment reminders</label>
          <select id="notificationPreference" value={form.notificationPreference} onChange={(e) => set("notificationPreference", e.target.value)}>
            <option value="email">Email</option><option value="text">Text</option><option value="both">Email and text</option>
          </select>
          {form.notificationPreference !== "email" && <label className="request-check"><input type="checkbox" required checked={form.smsConsent} onChange={(e) => set("smsConsent", e.target.checked)} /> I agree to receive appointment reminders and service updates by text at this number. Message and data rates may apply.</label>}
          <small>Your invoice will be sent to your email after the job is completed.</small>

          <div className="request-estimate"><span>Estimated price before eligible discounts</span><strong>{estimate}</strong><small>Eligible multi-pet and second-booking discounts are applied automatically when you submit. Booking requests are pending admin review and approval.</small></div>
          {error && <p className="account-message account-message-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || (isDogOnly && form.species !== "dog")}>
            {loading ? "Submitting booking request…" : form.createAccount && !currentUser ? "Create account & request booking" : "Request booking"}
          </button>
          <p className="request-hint">Your request will be marked pending until an admin reviews and approves it.</p>
        </form>
        {currentUser && <p className="account-footer">Your request will be linked to your account so you can manage it later.</p>}
        <Link href="/#services" className="account-home-link">Back to services</Link>
      </section>
    </main>
  );
}
