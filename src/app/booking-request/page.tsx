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
  | "Dog Walking";

const SERVICE_NAMES: ServiceName[] = [
  "Boarding",
  "House Sitting",
  "Drop-In Visits",
  "Doggy Day Care",
  "Dog Walking",
];

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
  serviceName: "Dog Walking" as ServiceName,
  serviceOption: "30 minutes",
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "17:00",
  medicationRequired: false,
  medicationInstructions: "",
  pickup: false,
  dropoff: false,
  soloCare: false,
  getsAlongWithPets: "",
  extendedMorning: false,
  notes: "",
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
    const match = SERVICE_NAMES.find(
      (name) => name.toLowerCase() === requested?.toLowerCase()
    );
    if (match) {
      setForm((current) => ({
        ...current,
        serviceName: match,
        serviceOption:
          match === "Boarding" ? "Standard boarding" :
          match === "House Sitting" ? "Flexible overnight" :
          match === "Drop-In Visits" ? "30 minutes" :
          match === "Doggy Day Care" ? "Group care" : "30 minutes",
        startTime: match === "Doggy Day Care" ? "07:30" : "09:00",
        endTime: match === "Doggy Day Care" ? "17:00" : "17:00",
      }));
    }
  }, []);

  function set<K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeService(serviceName: ServiceName) {
    setForm((current) => ({
      ...current,
      serviceName,
      serviceOption:
        serviceName === "Boarding" ? "Standard boarding" :
        serviceName === "House Sitting" ? "Flexible overnight" :
        serviceName === "Drop-In Visits" ? "30 minutes" :
          serviceName === "Doggy Day Care" ? "Group care" : "30 minutes",
        startTime: serviceName === "Doggy Day Care" ? "07:30" : current.serviceName === "Doggy Day Care" ? "09:00" : current.startTime,
        endTime: serviceName === "Doggy Day Care" ? "17:00" : current.endTime,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
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
          petId: selectedPetId || undefined,
          notes: `${form.notes}${form.extendedMorning ? "\nExtended morning care requested (+$20)." : ""}`,
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

  const isOvernight = form.serviceName === "Boarding" || form.serviceName === "House Sitting";
  const isDogOnly = ["Boarding", "Doggy Day Care", "Dog Walking"].includes(form.serviceName);
  const nights = form.startDate && form.endDate
    ? Math.max(0, Math.round((new Date(`${form.endDate}T12:00:00`).getTime() - new Date(`${form.startDate}T12:00:00`).getTime()) / 86400000))
    : 0;
  let estimate = "Confirmed by our team";
  if (form.serviceName === "Boarding" && nights > 0) {
    estimate = `$${(nights * (form.soloCare ? 60 : 40) + (form.pickup ? 20 : 0) + (form.dropoff ? 20 : 0)).toFixed(2)}`;
  } else if (form.serviceName === "House Sitting" && nights > 0) {
    estimate = `$${(nights * (form.serviceOption === "Dedicated overnight" ? 100 : 80) + (form.extendedMorning && form.serviceOption === "Flexible overnight" ? 20 : 0)).toFixed(2)}`;
  } else if (form.serviceName === "Dog Walking") {
    estimate = form.serviceOption === "60 minutes" ? "$50.00" : "$30.00";
  } else if (form.serviceName === "Drop-In Visits") {
    estimate = `$${((form.serviceOption === "45 minutes" ? 40 : 30) + (form.medicationRequired ? 5 : 0)).toFixed(2)}`;
  } else if (form.serviceName === "Doggy Day Care") {
    estimate = "$35.00 per day";
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
          <select id="serviceName" value={form.serviceName} onChange={(e) => changeService(e.target.value as ServiceName)}>
            {SERVICE_NAMES.map((name) => <option key={name}>{name}</option>)}
          </select>

          {form.serviceName === "Boarding" && <>
            <label htmlFor="boardingOption">Boarding style</label>
            <select id="boardingOption" value={form.soloCare ? "Solo care" : "Standard boarding"} onChange={(e) => set("soloCare", e.target.value === "Solo care")}>
              <option value="Standard boarding">Standard boarding — $40/night</option>
              <option value="Solo care">Solo care, no other pets — $60/night</option>
            </select>
            <label className="request-check"><input type="checkbox" checked={form.pickup} onChange={(e) => set("pickup", e.target.checked)} /> Pick up my pet (+$20)</label>
            <label className="request-check"><input type="checkbox" checked={form.dropoff} onChange={(e) => set("dropoff", e.target.checked)} /> Drop off my pet (+$20)</label>
            <p className="request-hint">Each trip is $20 within our service area. You can also bring your pet to and from the caregiver’s home.</p>
          </>}

          {form.serviceName === "House Sitting" && <>
            <label htmlFor="overnightOption">Overnight care</label>
            <select id="overnightOption" value={form.serviceOption} onChange={(e) => {
              const option = e.target.value;
              setForm((current) => ({
                ...current,
                serviceOption: option,
                extendedMorning: option === "Dedicated overnight" ? false : current.extendedMorning,
              }));
            }}>
              <option>Flexible overnight</option><option>Dedicated overnight</option>
            </select>
            <p className="request-hint">
              {form.serviceOption === "Dedicated overnight"
                ? "Dedicated care runs from 10:00 PM to 7:00 AM, without leaving for other pet appointments."
                : "Flexible care starts at 8:00 PM and runs until 7:00 AM. The caregiver may visit other pets before 8:00 PM."}
            </p>
            {form.serviceOption === "Flexible overnight" && <label className="request-check"><input type="checkbox" checked={form.extendedMorning} onChange={(e) => set("extendedMorning", e.target.checked)} /> Extend morning care until 9:00 AM (+$20)</label>}
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

          {form.serviceName === "Doggy Day Care" && <p className="request-hint">Supervised group day care is $35/day, from 8:00 AM to 5:00 PM. Drop-off is available from 7:30–8:00 AM; pick up by 5:00 PM. Dogs should be comfortable with other dogs or suitable for a gradual introduction. We’ll review compatibility before approval.</p>}

          <div className="request-fields-two">
            <label> {isOvernight ? "Check-in date" : "Service date"}
              <input type="date" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </label>
            {isOvernight ? <label>Check-out date
              <input type="date" required min={form.startDate} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </label> : form.serviceName === "Doggy Day Care" ? <label>Pick-up time
              <input type="time" required min="08:00" max="17:00" step={900} value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </label> : <label>Start time
              <input type="time" required value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </label>}
          </div>
          {form.serviceName !== "Doggy Day Care" && <label htmlFor="serviceAddress">
            {form.serviceName === "Boarding" ? "Pickup / drop-off address (if needed)" : "Where should we meet your pet?"}
            <input id="serviceAddress" autoComplete="street-address" required={form.serviceName !== "Boarding" || form.pickup || form.dropoff} value={form.serviceAddress} onChange={(e) => set("serviceAddress", e.target.value)} />
          </label>}
          {!isOvernight && form.serviceName === "Doggy Day Care" && <label>Drop-off time (7:30–8:00 AM)<input type="time" required min="07:30" max="08:00" step={900} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} /></label>}

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
          {(form.serviceName === "Boarding" || form.serviceName === "Doggy Day Care") && <>
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

          <div className="request-estimate"><span>Estimated price</span><strong>{estimate}</strong><small>Pending admin review and approval.</small></div>
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
