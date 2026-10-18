
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Pet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
};

type ServiceName =
  | "Dog Walking"
  | "Drop-In Visits"
  | "Pet Sitting & Overnight Care";

type ServiceOption =
  | "30 minutes"
  | "45 minutes"
  | "60 minutes"
  | "Flexible overnight"
  | "Dedicated overnight";

type ServiceDraft = {
  id: string;
  petId: string;
  serviceName: ServiceName;
  serviceOption: ServiceOption;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  notes: string;
  medicationRequired: boolean;
  medicationInstructions: string;
};

const MEDICATION_FEE = 5;
const MULTI_PET_DISCOUNT = 10;

const BLOCKED_START_MINUTES = 7 * 60 + 30;
const BLOCKED_END_MINUTES = 17 * 60 + 30;

function buildTimeOptions(start: string, end: string) {
  const options: string[] = [];
  let minutes =
    Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes =
    Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));

  while (minutes <= endMinutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    options.push(
      `${String(hours).padStart(2, "0")}:${String(
        remainingMinutes
      ).padStart(2, "0")}`
    );

    minutes += 30;
  }

  return options;
}

function formatTimeLabel(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

const OVERNIGHT_CHECKIN_OPTIONS = buildTimeOptions("18:00", "23:30");
const OVERNIGHT_CHECKOUT_OPTIONS = buildTimeOptions("00:00", "07:00");
const DROP_IN_START_OPTIONS = buildTimeOptions("06:00", "22:00");

const OVERNIGHT_START_TIME = "18:00";
const OVERNIGHT_END_TIME = "07:00";

const SERVICE_OPTIONS: Record<ServiceName, ServiceOption[]> = {
  "Dog Walking": ["30 minutes", "60 minutes"],
  "Drop-In Visits": ["30 minutes", "45 minutes"],
  "Pet Sitting & Overnight Care": [
    "Flexible overnight",
    "Dedicated overnight",
  ],
};

const ALL_SERVICES: ServiceName[] = [
  "Dog Walking",
  "Drop-In Visits",
  "Pet Sitting & Overnight Care",
];

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function getObservedFixedHoliday(
  year: number,
  month: number,
  day: number
): string {
  const holiday = new Date(year, month - 1, day, 12);
  const weekday = holiday.getDay();

  if (weekday === 6) {
    holiday.setDate(holiday.getDate() - 1);
  } else if (weekday === 0) {
    holiday.setDate(holiday.getDate() + 1);
  }

  return localDateString(holiday);
}

function isMajorHoliday(dateString: string): boolean {
  if (!dateString) return false;

  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay();

  const fixedHolidays = [
    getObservedFixedHoliday(year, 1, 1),
    getObservedFixedHoliday(year, 7, 4),
    getObservedFixedHoliday(year, 12, 25),
  ];

  if (fixedHolidays.includes(dateString)) return true;

  if (month === 5 && weekday === 1) {
    const nextWeek = new Date(year, 4, day + 7, 12);
    if (nextWeek.getMonth() !== 4) return true;
  }

  if (month === 9 && weekday === 1 && day <= 7) return true;

  if (
    month === 11 &&
    weekday === 4 &&
    day >= 22 &&
    day <= 28
  ) {
    return true;
  }

  return false;
}

function isBlockedStartTime(
  dateString: string,
  timeString: string
): boolean {
  if (!dateString || !timeString) return false;
  if (isMajorHoliday(dateString)) return false;

  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return false;

  const [hours, minutes] = timeString.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;

  return (
    totalMinutes >= BLOCKED_START_MINUTES &&
    totalMinutes <= BLOCKED_END_MINUTES
  );
}

function getAvailableDropInTimes(dateString: string) {
  if (!dateString || isMajorHoliday(dateString)) {
    return DROP_IN_START_OPTIONS;
  }

  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return DROP_IN_START_OPTIONS;

  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return DROP_IN_START_OPTIONS;

  return DROP_IN_START_OPTIONS.filter(
    (time) => !isBlockedStartTime(dateString, time)
  );
}

function makeDraft(): ServiceDraft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowString = localDateString(tomorrow);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    petId: "",
    serviceName: "Dog Walking",
    serviceOption: "30 minutes",
    startDate: tomorrowString,
    startTime: "09:00",
    endDate: tomorrowString,
    endTime: "09:30",
    notes: "",
    medicationRequired: false,
    medicationInstructions: "",
  };
}

function getAvailableServices(petId: string, pets: Pet[]): ServiceName[] {
  const selectedPet = pets.find((pet) => pet.id === petId);

  if (!selectedPet) return ALL_SERVICES;

  if (selectedPet.species?.trim().toLowerCase() === "dog") {
    return ALL_SERVICES;
  }

  return ALL_SERVICES.filter((service) => service !== "Dog Walking");
}

function getDuration(option: ServiceOption) {
  if (option === "30 minutes") return 30;
  if (option === "45 minutes") return 45;
  if (option === "60 minutes") return 60;
  return null;
}

function getEndDateTime(draft: ServiceDraft) {
  const duration = getDuration(draft.serviceOption);

  if (duration !== null) {
    const start = new Date(
      `${draft.startDate}T${draft.startTime}:00`
    );
    start.setMinutes(start.getMinutes() + duration);
    return start;
  }

  return new Date(`${draft.endDate}T${draft.endTime}:00`);
}

function getOvernightNights(draft: ServiceDraft) {
  const startDate = new Date(`${draft.startDate}T12:00:00`);
  const endDate = new Date(`${draft.endDate}T12:00:00`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  const difference =
    (endDate.getTime() - startDate.getTime()) / 86400000;

  if (difference < 1) return null;

  return Math.round(difference);
}

function getPrice(draft: ServiceDraft): number | null {
  if (draft.serviceName === "Dog Walking") {
    return draft.serviceOption === "60 minutes" ? 50 : 30;
  }

  if (draft.serviceName === "Drop-In Visits") {
    return draft.serviceOption === "45 minutes" ? 40 : 30;
  }

  if (
    !draft.startDate ||
    !draft.startTime ||
    !draft.endDate ||
    !draft.endTime
  ) {
    return null;
  }

  const start = new Date(`${draft.startDate}T${draft.startTime}:00`);
  const end = getEndDateTime(draft);
  const nights = getOvernightNights(draft);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime() ||
    nights === null
  ) {
    return null;
  }

  const nightlyRate =
    draft.serviceOption === "Dedicated overnight" ? 100 : 80;

  return nightlyRate * nights;
}

function formatPrice(price: number | null) {
  return price === null ? "Check dates and times" : `$${price.toFixed(2)}`;
}

function isOvernightService(draft: ServiceDraft) {
  return draft.serviceName === "Pet Sitting & Overnight Care";
}

function getOvernightTimeError(draft: ServiceDraft) {
  if (!isOvernightService(draft)) return "";

  if (!OVERNIGHT_CHECKIN_OPTIONS.includes(draft.startTime)) {
    return "Please choose an overnight check-in time between 6:00 PM and 11:30 PM.";
  }

  if (!OVERNIGHT_CHECKOUT_OPTIONS.includes(draft.endTime)) {
    return "Please choose a checkout time between 12:00 AM and 7:00 AM.";
  }

  return "";
}

function getBlockedTimeError(draft: ServiceDraft) {
  if (isOvernightService(draft)) return "";

  if (isBlockedStartTime(draft.startDate, draft.startTime)) {
    return "Unavailable";
  }

  return "";
}

export default function BookPage() {
  const router = useRouter();

  const [pets, setPets] = useState<Pet[]>([]);
  const [services, setServices] = useState<ServiceDraft[]>([]);
const [today, setToday] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
  let active = true;

  const currentDate = new Date();
  setToday(localDateString(currentDate));
  setServices([makeDraft()]);

  async function loadCustomerPets() {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError || !data.user) {
        router.replace("/login");
        return;
      }

      const { data: petData, error: petError } = await supabase
        .from("pets")
        .select("id, name, species, breed")
        .eq("owner_id", data.user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (petError) {
        setError("We couldn't load your pets. Please refresh and try again.");
      } else {
        setPets((petData || []) as Pet[]);
      }

      setLoading(false);
    }

    loadCustomerPets();

    return () => {
      active = false;
    };
  }, [router]);

  function updateService(id: string, changes: Partial<ServiceDraft>) {
    setServices((current) =>
      current.map((service) => {
        if (service.id !== id) return service;

        const updated = { ...service, ...changes };
        const selectedPet = pets.find((pet) => pet.id === updated.petId);
        const isDog =
          selectedPet?.species?.trim().toLowerCase() === "dog";

        if (
          selectedPet &&
          !isDog &&
          updated.serviceName === "Dog Walking"
        ) {
          updated.serviceName = "Drop-In Visits";
        }

        const serviceChanged =
          Boolean(changes.serviceName) ||
          updated.serviceName !== service.serviceName;

        if (serviceChanged) {
          updated.serviceOption = SERVICE_OPTIONS[updated.serviceName][0];

          if (updated.serviceName === "Pet Sitting & Overnight Care") {
            updated.startTime = OVERNIGHT_START_TIME;
            updated.endDate = addDays(updated.startDate, 1);
            updated.endTime = OVERNIGHT_END_TIME;
          } else if (
            updated.serviceName === "Drop-In Visits" &&
            !DROP_IN_START_OPTIONS.includes(updated.startTime)
          ) {
            updated.startTime = "09:00";
          }
        }

        if (
          changes.startDate &&
          !isOvernightService(updated) &&
          isBlockedStartTime(updated.startDate, updated.startTime)
        ) {
          updated.startTime = "06:00";
        }

        if (
          updated.serviceName === "Pet Sitting & Overnight Care" &&
          changes.startDate &&
          updated.endDate <= updated.startDate
        ) {
          updated.endDate = addDays(updated.startDate, 1);
        }

        if (
          updated.serviceName === "Dog Walking" ||
          updated.serviceName === "Drop-In Visits"
        ) {
          const duration = getDuration(updated.serviceOption);
          const start = new Date(
            `${updated.startDate}T${updated.startTime}:00`
          );

          if (duration !== null && !Number.isNaN(start.getTime())) {
            start.setMinutes(start.getMinutes() + duration);
            updated.endDate = localDateString(start);
            updated.endTime = `${String(start.getHours()).padStart(
              2,
              "0"
            )}:${String(start.getMinutes()).padStart(2, "0")}`;
          }
        }

        return updated;
      })
    );

    setError("");
    setNotice("");
  }

  function addService() {
    setServices((current) => [...current, makeDraft()]);
    setError("");
    setNotice("");
  }

  function removeService(id: string) {
    setServices((current) =>
      current.filter((service) => service.id !== id)
    );
    setError("");
    setNotice("");
  }

  const subtotal = services.reduce(
    (sum, service) => sum + (getPrice(service) ?? 0),
    0
  );

  const selectedPetCount = new Set(
    services.map((service) => service.petId).filter(Boolean)
  ).size;

  const discountAmount =
    selectedPetCount >= 2 ? MULTI_PET_DISCOUNT : 0;

  const medicationFee = services.some(
    (service) => service.medicationRequired
  )
    ? MEDICATION_FEE
    : 0;

  const total = Math.max(0, subtotal + medicationFee - discountAmount);

  const hasInvalidOvernight = services.some((service) => {
    if (!isOvernightService(service)) return false;

    return (
      getPrice(service) === null ||
      Boolean(getOvernightTimeError(service))
    );
  });

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (pets.length === 0) {
      setError(
        "Please add a pet to your dashboard before requesting a booking."
      );
      return;
    }

    if (services.length === 0) {
      setError("Please add at least one service.");
      return;
    }

    if (services.some((service) => !service.petId)) {
      setError("Please select a pet for every service.");
      return;
    }

    for (const service of services) {
      if (!service.startDate || !service.startTime) {
        setError("Please enter a date and start time for every service.");
        return;
      }

      const start = new Date(
        `${service.startDate}T${service.startTime}:00`
      );
      const end = getEndDateTime(service);

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end.getTime() <= start.getTime()
      ) {
        setError("Please check the dates and times for each service.");
        return;
      }

      if (start.getTime() <= Date.now()) {
        setError("All services must start in the future.");
        return;
      }

      const blockedTimeError = getBlockedTimeError(service);
      if (blockedTimeError) {
        setError(blockedTimeError);
        return;
      }

      const overnightError = getOvernightTimeError(service);
      if (overnightError) {
        setError(overnightError);
        return;
      }

      if (
        isOvernightService(service) &&
        getOvernightNights(service) === null
      ) {
        setError(
          "Overnight checkout must be on a later date than check-in."
        );
        return;
      }

      if (
        service.medicationRequired &&
        !service.medicationInstructions.trim()
      ) {
        setError(
          "Please enter medication instructions for every service that requires medication."
        );
        return;
      }
    }

    if (hasInvalidOvernight) {
      setError(
        "Please check your overnight dates and times. Check-in starts at 6:00 PM, and checkout must be by 7:00 AM."
      );
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const servicePayload = services.map((service) => {
        const start = new Date(
          `${service.startDate}T${service.startTime}:00`
        );
        const end = getEndDateTime(service);

        return {
          pet_id: service.petId,
          service_name: service.serviceName,
          service_option: service.serviceOption,
          service_start: start.toISOString(),
          service_end: end.toISOString(),
          service_notes: service.notes.trim(),
          medication_required: service.medicationRequired,
          medication_instructions: service.medicationRequired
            ? service.medicationInstructions.trim()
            : "",
        };
      });

      const { error: bookingError } = await supabase.rpc(
        "submit_booking_request",
        {
          p_request_notes: requestNotes.trim(),
          p_services: servicePayload,
        }
      );

      if (bookingError) throw bookingError;

      setNotice("Your booking request has been submitted successfully!");
      setTimeout(() => router.push("/dashboard"), 1400);
    } catch (submissionError) {
      console.error("Booking request error:", submissionError);

      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We couldn't submit your request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="booking-page">
        <div className="booking-loading">
          <span className="paw-decoration" aria-hidden="true">🐾</span>
          <p>Preparing your booking form…</p>
        </div>

        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="booking-page">
      <div className="paw-pattern paw-pattern-top" aria-hidden="true">🐾</div>
      <div className="paw-pattern paw-pattern-side" aria-hidden="true">🐾</div>

      <div className="booking-shell">
        <header className="booking-header">
          <a className="booking-brand" href="/">
            <span className="booking-brand-mark" aria-hidden="true">🐾</span>
            <span className="booking-brand-copy">
              <strong>Paws in Motion</strong>
              <small>Thoughtful care for your best friend</small>
            </span>
          </a>

          <a className="booking-back-link" href="/dashboard">
            <span aria-hidden="true">←</span> My dashboard
          </a>
        </header>

        <section className="booking-intro">
          <div className="intro-paw" aria-hidden="true">🐾</div>
          <span className="booking-eyebrow">LET’S MAKE A PLAN</span>
          <h1>Book a little peace of mind.</h1>
          <p>
            Tell us what your pet needs. You can request multiple
            services together, including care for different pets.
            We’ll review your request before confirming your booking.
          </p>
          <div className="intro-details">
            <span><span aria-hidden="true">♡</span> Thoughtful, personalized care</span>
            <span><span aria-hidden="true">✓</span> Reviewed before confirmation</span>
          </div>
        </section>

        {pets.length === 0 ? (
          <section className="booking-empty-pets">
            <span className="booking-empty-icon" aria-hidden="true">🐾</span>
            <span className="booking-eyebrow">ONE LITTLE STEP FIRST</span>
            <h2>Let’s meet your pet first.</h2>
            <p>
              Add your pet to your dashboard before creating a
              booking request.
            </p>
            <button
              type="button"
              className="booking-primary-button"
              onClick={() => router.push("/dashboard")}
            >
              Go to my dashboard <span aria-hidden="true">→</span>
            </button>
          </section>
        ) : (
          <form className="booking-form" onSubmit={handleSubmit}>
            <div className="booking-form-heading">
              <div>
                <span className="booking-step-label">YOUR REQUEST</span>
                <h2>What care do you need?</h2>
                <p>Build your request one service at a time.</p>
              </div>
              <span className="booking-count">
                <span aria-hidden="true">🐾</span> {services.length}{" "}
                {services.length === 1 ? "service" : "services"}
              </span>
            </div>

            {services.map((service, index) => (
              <section className="booking-service-card" key={service.id}>
                <div className="booking-service-heading">
                  <div className="booking-service-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="booking-service-title">
                    <h3>Service {index + 1}</h3>
                    <p>Choose the care that works best.</p>
                  </div>
                  {services.length > 1 && (
                    <button
                      type="button"
                      className="booking-remove-button"
                      onClick={() => removeService(service.id)}
                      aria-label={`Remove service ${index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="booking-field-grid">
                  <label className="booking-field">
                    <span>Service</span>
                    <select
                      value={service.serviceName}
                      onChange={(event) =>
                        updateService(service.id, {
                          serviceName: event.target.value as ServiceName,
                        })
                      }
                    >
                      {getAvailableServices(service.petId, pets).map(
                        (serviceName) => (
                          <option key={serviceName} value={serviceName}>
                            {serviceName}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="booking-field">
                    <span>Service option</span>
                    <select
                      value={service.serviceOption}
                      onChange={(event) =>
                        updateService(service.id, {
                          serviceOption: event.target.value as ServiceOption,
                        })
                      }
                    >
                      {SERVICE_OPTIONS[service.serviceName].map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="booking-field">
                    <span>Which pet?</span>
                    <select
                      value={service.petId}
                      onChange={(event) =>
                        updateService(service.id, {
                          petId: event.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select your pet</option>
                      {pets.map((pet) => (
                        <option key={pet.id} value={pet.id}>
                          {pet.name}{pet.species ? ` · ${pet.species}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="booking-field">
                    <span>Start date</span>
                    <input
                      type="date"
                      value={service.startDate}
                      min={today}
                      required
                      onChange={(event) =>
                        updateService(service.id, {
                          startDate: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="booking-field">
                    <span>
                      {isOvernightService(service) ? "Check-in time" : "Start time"}
                    </span>

                    {isOvernightService(service) ? (
                      <select
                        value={service.startTime}
                        required
                        onChange={(event) =>
                          updateService(service.id, {
                            startTime: event.target.value,
                          })
                        }
                      >
                        {OVERNIGHT_CHECKIN_OPTIONS.map((time) => (
                          <option key={time} value={time}>{formatTimeLabel(time)}</option>
                        ))}
                      </select>
                    ) : service.serviceName === "Drop-In Visits" ? (
                      <select
                        value={service.startTime}
                        required
                        onChange={(event) =>
                          updateService(service.id, {
                            startTime: event.target.value,
                          })
                        }
                      >
                        {getAvailableDropInTimes(service.startDate).map((time) => (
                          <option key={time} value={time}>{formatTimeLabel(time)}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="time"
                        value={service.startTime}
                        required
                        onChange={(event) =>
                          updateService(service.id, {
                            startTime: event.target.value,
                          })
                        }
                      />
                    )}

                    {isOvernightService(service) && (
                      <small>
                        Check-in is available from 6:00 PM to 11:30 PM.
                        For earlier care, request a separate Drop-In Visit.
                      </small>
                    )}

                    {service.serviceName === "Drop-In Visits" && (
                      <small>
                        {isMajorHoliday(service.startDate)
                          ? ""
                          : "Weekdays: start times from 7:30 AM through 5:30 PM are unavailable. Weekends and major holidays have no daytime restriction."}
                      </small>
                    )}

                    {service.serviceName === "Dog Walking" && (
                      <small>
                        {isMajorHoliday(service.startDate)
                          ? ""
                          : "Weekdays: start times from 7:30 AM through 5:30 PM are unavailable. Weekends and major holidays have no daytime restriction."}
                      </small>
                    )}
                  </label>

                  {isOvernightService(service) && (
                    <>
                      <label className="booking-field">
                        <span>Checkout date</span>
                        <input
                          type="date"
                          value={service.endDate}
                          min={service.startDate || today}
                          required
                          onChange={(event) =>
                            updateService(service.id, {
                              endDate: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="booking-field">
                        <span>Checkout time</span>
                        <select
                          value={service.endTime}
                          required
                          onChange={(event) =>
                            updateService(service.id, {
                              endTime: event.target.value,
                            })
                          }
                        >
                          {OVERNIGHT_CHECKOUT_OPTIONS.map((time) => (
                            <option key={time} value={time}>{formatTimeLabel(time)}</option>
                          ))}
                        </select>
                        <small>Checkout is available until 7:00 AM.</small>
                      </label>
                    </>
                  )}
                </div>

                {getBlockedTimeError(service) && (
                  <div className="booking-message booking-error" role="alert">
                    {getBlockedTimeError(service)}
                  </div>
                )}

                <div className="booking-medication-panel">
                  <label className="booking-medication-toggle">
                    <input
                      type="checkbox"
                      checked={service.medicationRequired}
                      onChange={(event) =>
                        updateService(service.id, {
                          medicationRequired: event.target.checked,
                          medicationInstructions: event.target.checked
                            ? service.medicationInstructions
                            : "",
                        })
                      }
                    />
                    <span>
                      <strong>Medication administration needed</strong>
                      <small>
                        Adds a one-time $5 medication fee to the entire booking.
                      </small>
                    </span>
                  </label>

                  {service.medicationRequired && (
                    <>
                      <div className="booking-medication-price">
                        <span>Additional medication fee</span>
                        <strong>+${MEDICATION_FEE.toFixed(2)}</strong>
                      </div>
                      <label className="booking-field">
                        <span>Medication instructions (required)</span>
                        <textarea
                          value={service.medicationInstructions}
                          onChange={(event) =>
                            updateService(service.id, {
                              medicationInstructions: event.target.value,
                            })
                          }
                          placeholder="Medication name, prescribed dose, timing, and any special instructions…"
                          rows={3}
                          required
                        />
                      </label>
                    </>
                  )}
                </div>

                <label className="booking-field booking-notes-field">
                  <span>Instructions for this service (optional)</span>
                  <textarea
                    value={service.notes}
                    onChange={(event) =>
                      updateService(service.id, { notes: event.target.value })
                    }
                    placeholder="For example: leash location, feeding routine, or access instructions…"
                    rows={3}
                  />
                </label>

                <div className="booking-service-price">
                  <div>
                    <span>Price for this service</span>
                    <small>
                      {isOvernightService(service)
                        ? "Based on the number of nights and your selected overnight care option."
                        : `For ${service.serviceOption.toLowerCase()}.`}
                    </small>
                  </div>
                  <strong>
                    {formatPrice(
                      getPrice(service) === null
                        ? null
                        : getPrice(service)! +
                          (service.medicationRequired ? MEDICATION_FEE : 0)
                    )}
                  </strong>
                </div>
              </section>
            ))}

            {services.length < 20 && (
              <button
                type="button"
                className="booking-add-button"
                onClick={addService}
              >
                <span className="add-icon">＋</span>
                <span>
                  <strong>Add another service</strong>
                  <small>
                    Each service has its own price and adds to your estimate.
                  </small>
                </span>
              </button>
            )}

            <section className="booking-notes-panel">
              <div className="notes-heading">
                <span className="notes-paw" aria-hidden="true">🐾</span>
                <div>
                  <span className="booking-step-label">THE LITTLE DETAILS</span>
                  <h2>Anything else we should know?</h2>
                </div>
              </div>
              <p>
                Share any other information that will help us care for your pet.
              </p>
              <label className="booking-field">
                <span>Additional booking notes (optional)</span>
                <textarea
                  value={requestNotes}
                  onChange={(event) => setRequestNotes(event.target.value)}
                  placeholder="Your pet’s routine, access instructions, or anything else we should know…"
                  rows={4}
                />
              </label>
            </section>

            <section className="booking-summary">
              <div className="summary-main">
                <span className="booking-step-label">YOUR ESTIMATE</span>
                <h2>Care, planned with love.</h2>
                <p>
                  {services.length} {services.length === 1 ? "service" : "services"} requested
                </p>
                <small>
                  Final details and pricing will be reviewed before confirmation.
                </small>

                <div className="booking-price-breakdown">
                  <div className="booking-price-row">
                    <span>Service subtotal</span>
                    <strong>${subtotal.toFixed(2)}</strong>
                  </div>
                  <div className="booking-price-row">
                    <span>Medication fee</span>
                    <strong>
                      {medicationFee > 0 ? `+$${medicationFee.toFixed(2)}` : "$0.00"}
                    </strong>
                  </div>
                  <div className="booking-price-row">
                    <span>
                      Multi-pet discount{selectedPetCount >= 2 ? " applied" : ""}
                    </span>
                    <strong className={discountAmount > 0 ? "booking-discount" : ""}>
                      {discountAmount > 0
                        ? `−$${discountAmount.toFixed(2)}`
                        : "$0.00"}
                    </strong>
                  </div>
                  <small>
                    {selectedPetCount >= 2
                      ? `Discount applied for ${selectedPetCount} different pets.`
                      : "Select services for at least two different pets to receive $10 off."}
                  </small>
                </div>
              </div>
              <div className="summary-total">
                <span>Estimated total</span>
                <strong className="booking-total">${total.toFixed(2)}</strong>
              </div>
            </section>

            {error && (
              <div className="booking-message booking-error" role="alert">
                <span aria-hidden="true">!</span> {error}
              </div>
            )}

            {notice && (
              <div className="booking-message booking-success" role="status">
                <span aria-hidden="true">✓</span> {notice}
              </div>
            )}

            <div className="booking-submit-row">
              <p>
                <span aria-hidden="true">🐾</span> Your booking request will be
                reviewed. Your appointment is confirmed once accepted.
              </p>
              <button
                type="submit"
                className="booking-primary-button"
                disabled={submitting}
              >
                {submitting ? "Sending request…" : "Request booking →"}
              </button>
            </div>
          </form>
        )}

        <footer className="booking-footer">
          <span aria-hidden="true">🐾</span>
          <p>Made with care for the pets who make life better.</p>
          <span aria-hidden="true">🐾</span>
        </footer>
      </div>

      <style jsx>{styles}</style>
    </main>
  );
}

const styles = `
  :global(*) {
    box-sizing: border-box;
  }

  .booking-page {
    --green: #326447;
    --green-dark: #244c35;
    --green-light: #e5f0e8;
    --green-soft: #f1f6f1;
    --text: #24352b;
    --muted: #718075;
    --border: #e3eae3;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    background: #f5f7f5;
    color: var(--text);
    padding: 0 22px;
    font-family: inherit;
  }

  .booking-shell {
    width: 100%;
    max-width: 1050px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }

  .booking-header {
    min-height: 88px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    border-bottom: 1px solid #e6ebe5;
  }

  .booking-brand {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    color: inherit;
    text-decoration: none;
  }

  .booking-brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    background: var(--green);
    display: grid;
    place-items: center;
    color: white;
    font-size: 25px;
    box-shadow: 0 5px 14px #32644720;
  }

  .booking-brand-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .booking-brand-copy strong {
    font-size: 19px;
    letter-spacing: -0.6px;
    font-weight: 750;
  }

  .booking-brand-copy small {
    font-size: 12px;
    color: var(--muted);
  }

  .booking-back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #dce5dc;
    border-radius: 999px;
    padding: 10px 16px;
    color: var(--green);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    background: #fff;
    transition: background 0.2s, transform 0.2s;
  }

  .booking-back-link:hover {
    background: var(--green-light);
    transform: translateY(-1px);
  }

  .booking-intro {
    position: relative;
    overflow: hidden;
    margin: 30px 0 25px;
    padding: 43px 46px;
    border-radius: 25px;
    background: #e5f0e8;
    border: 1px solid #d8e8da;
  }

  .booking-eyebrow,
  .booking-step-label {
    display: inline-block;
    color: var(--green);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.7px;
  }

  .booking-intro h1 {
    max-width: 650px;
    margin: 12px 0 13px;
    font-size: clamp(30px, 4.2vw, 46px);
    line-height: 1.1;
    letter-spacing: -1.8px;
    color: #244c35;
    font-weight: 800;
  }

  .booking-intro > p {
    max-width: 640px;
    margin: 0;
    color: #5f7465;
    font-size: 15px;
    line-height: 1.8;
  }

  .intro-paw {
    position: absolute;
    right: 50px;
    top: 22px;
    font-size: 105px;
    opacity: 0.1;
    transform: rotate(-18deg);
    pointer-events: none;
  }

  .intro-details {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 22px;
    margin-top: 22px;
    color: #42634c;
    font-size: 12px;
    font-weight: 650;
  }

  .intro-details span span {
    margin-right: 6px;
    color: var(--green);
    font-weight: 900;
  }

  .paw-pattern {
    position: absolute;
    pointer-events: none;
    user-select: none;
    color: #326447;
    opacity: 0.055;
    font-size: 120px;
    z-index: 0;
  }

  .paw-pattern-top {
    top: 150px;
    right: 3%;
    transform: rotate(22deg);
  }

  .paw-pattern-side {
    top: 740px;
    left: -32px;
    font-size: 90px;
    transform: rotate(-25deg);
  }

  .booking-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .booking-form-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 14px 2px 6px;
  }

  .booking-form-heading h2,
  .booking-notes-panel h2,
  .booking-summary h2 {
    margin: 7px 0 5px;
    font-size: 23px;
    letter-spacing: -0.8px;
    line-height: 1.25;
    color: #293b2f;
  }

  .booking-form-heading p,
  .booking-notes-panel > p {
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--muted);
  }

  .booking-count {
    flex-shrink: 0;
    border-radius: 999px;
    padding: 10px 14px;
    background: #e5f0e8;
    color: var(--green);
    font-size: 12px;
    font-weight: 750;
  }

  .booking-count span {
    margin-right: 5px;
  }

  .booking-service-card,
  .booking-notes-panel,
  .booking-summary,
  .booking-empty-pets {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 21px;
    box-shadow: 0 5px 20px #1e402b05;
  }

  .booking-service-card {
    padding: 27px;
  }

  .booking-service-heading {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 23px;
    margin-bottom: 23px;
    border-bottom: 1px solid #edf0ec;
  }

  .booking-service-number {
    width: 46px;
    height: 46px;
    flex-shrink: 0;
    border-radius: 15px;
    display: grid;
    place-items: center;
    background: var(--green-light);
    color: var(--green);
    font-size: 14px;
    font-weight: 850;
  }

  .booking-service-title {
    min-width: 0;
  }

  .booking-service-heading h3 {
    margin: 0 0 5px;
    font-size: 17px;
    letter-spacing: -0.3px;
    color: #2a3d30;
  }

  .booking-service-heading p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .booking-remove-button {
    margin-left: auto;
    border: 1px solid #f0dada;
    background: #fffafa;
    color: #a84b4b;
    border-radius: 10px;
    padding: 9px 12px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
  }

  .booking-remove-button:hover {
    background: #fff0f0;
  }

  .booking-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 21px 18px;
  }

  .booking-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    color: #3d5143;
    font-size: 12px;
    font-weight: 750;
  }

  .booking-field > span {
    line-height: 1.4;
  }

  .booking-field input,
  .booking-field select,
  .booking-field textarea {
    width: 100%;
    min-width: 0;
    border: 1px solid #dce5dc;
    border-radius: 11px;
    padding: 12px 13px;
    background: #fcfdfb;
    color: #293b2f;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }

  .booking-field input,
  .booking-field select {
    min-height: 45px;
  }

  .booking-field textarea {
    min-height: 88px;
    line-height: 1.65;
    resize: vertical;
  }

  .booking-field input:focus,
  .booking-field select:focus,
  .booking-field textarea:focus {
    border-color: #6b9a77;
    background: #fff;
    box-shadow: 0 0 0 3px #32644713;
  }

  .booking-field small {
    color: #839087;
    font-size: 11px;
    line-height: 1.6;
    font-weight: 500;
  }

  .booking-medication-panel {
    margin-top: 24px;
    padding: 18px;
    border-radius: 15px;
    border: 1px solid #dfeade;
    background: #f6f9f5;
  }

  .booking-medication-toggle {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
  }

  .booking-medication-toggle input {
    width: 17px;
    height: 17px;
    margin-top: 2px;
    accent-color: var(--green);
    flex-shrink: 0;
    cursor: pointer;
  }

  .booking-medication-toggle span {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .booking-medication-toggle strong {
    color: #344b3a;
    font-size: 13px;
  }

  .booking-medication-toggle small {
    color: #7b897e;
    font-size: 11px;
    line-height: 1.6;
    font-weight: 500;
  }

  .booking-medication-price {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 18px 0;
    padding-top: 14px;
    border-top: 1px solid #e0e9df;
    color: #627466;
    font-size: 12px;
  }

  .booking-medication-price strong {
    color: var(--green);
    font-size: 14px;
  }

  .booking-notes-field {
    margin-top: 22px;
  }

  .booking-service-price {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-top: 23px;
    padding: 17px 19px;
    border-radius: 13px;
    background: #f0f6f0;
  }

  .booking-service-price > div {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .booking-service-price span {
    font-size: 12px;
    font-weight: 800;
    color: #3b5944;
  }

  .booking-service-price small {
    color: #7b897e;
    font-size: 11px;
    line-height: 1.5;
    font-weight: 500;
  }

  .booking-service-price > strong {
    color: var(--green);
    font-size: 19px;
    letter-spacing: -0.4px;
    text-align: right;
  }

  .booking-add-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    border: 1px dashed #9ab6a0;
    border-radius: 17px;
    background: #f3f8f2;
    color: var(--green);
    text-align: left;
    cursor: pointer;
    font: inherit;
    transition: background 0.2s, border-color 0.2s;
  }

  .booking-add-button:hover {
    background: #e9f3e9;
    border-color: var(--green);
  }

  .add-icon {
    width: 39px;
    height: 39px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: #dfeee0;
    font-size: 25px;
  }

  .booking-add-button > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .booking-add-button strong {
    font-size: 13px;
  }

  .booking-add-button small {
    color: #7b897e;
    font-size: 11px;
    line-height: 1.5;
  }

  .booking-notes-panel {
    padding: 27px;
  }

  .notes-heading {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 9px;
  }

  .notes-paw {
    width: 47px;
    height: 47px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: var(--green-light);
    border-radius: 15px;
    font-size: 23px;
  }

  .booking-notes-panel h2 {
    font-size: 21px;
  }

  .booking-notes-panel > p {
    margin-bottom: 22px;
  }

  .booking-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 25px;
    padding: 27px;
    background: #f0f6f0;
    border-color: #dce9dc;
  }

  .booking-summary h2 {
    font-size: 20px;
    margin-top: 8px;
  }

  .summary-main > p {
    margin: 8px 0 4px;
    color: #4e6555;
    font-size: 13px;
    font-weight: 700;
  }

  .summary-main > small {
    color: #7b897e;
    font-size: 11px;
    line-height: 1.6;
  }

  .booking-price-breakdown {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 430px;
    margin-top: 22px;
    padding-top: 17px;
    border-top: 1px solid #dbe7da;
  }

  .booking-price-row {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    color: #657669;
    font-size: 12px;
  }

  .booking-price-row strong {
    color: #344b3a;
    white-space: nowrap;
  }

  .booking-price-row .booking-discount {
    color: var(--green);
  }

  .booking-price-breakdown > small {
    color: #7b897e;
    font-size: 11px;
    line-height: 1.6;
  }

  .summary-total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    padding-left: 20px;
    border-left: 1px solid #dbe7da;
    gap: 10px;
  }

  .summary-total > span {
    color: #627466;
    font-size: 11px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  .booking-total {
    color: var(--green-dark);
    font-size: clamp(27px, 3vw, 36px);
    letter-spacing: -1px;
    font-weight: 850;
  }

  .booking-message {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 15px 17px;
    border-radius: 13px;
    font-size: 13px;
    line-height: 1.6;
  }

  .booking-message > span {
    flex-shrink: 0;
    font-weight: 900;
  }

  .booking-error {
    color: #994343;
    background: #fff2f0;
    border: 1px solid #f2d7d3;
  }

  .booking-success {
    color: #286441;
    background: #eaf7ed;
    border: 1px solid #cfe8d4;
  }

  .booking-submit-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 10px 0 8px;
  }

  .booking-submit-row p {
    max-width: 480px;
    margin: 0;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    color: #758278;
    font-size: 12px;
    line-height: 1.7;
  }

  .booking-submit-row p span {
    flex-shrink: 0;
  }

  .booking-primary-button {
    min-height: 48px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    padding: 13px 23px;
    border: 0;
    border-radius: 12px;
    background: var(--green);
    color: white;
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: 0 5px 12px #32644720;
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  }

  .booking-primary-button:hover:not(:disabled) {
    background: var(--green-dark);
    transform: translateY(-1px);
    box-shadow: 0 8px 17px #32644727;
  }

  .booking-primary-button:disabled {
    opacity: 0.65;
    cursor: wait;
  }

  .booking-empty-pets {
    padding: 52px 25px;
    text-align: center;
    margin: 25px 0 35px;
  }

  .booking-empty-icon {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    margin: 0 auto 20px;
    background: var(--green-light);
    border-radius: 23px;
    font-size: 34px;
  }

  .booking-empty-pets h2 {
    margin: 11px 0;
    font-size: 26px;
    letter-spacing: -0.8px;
    color: #293b2f;
  }

  .booking-empty-pets p {
    max-width: 430px;
    margin: 0 auto 23px;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.8;
  }

  .booking-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 32px 0 28px;
    color: #849087;
    font-size: 11px;
    text-align: center;
  }

  .booking-footer p {
    margin: 0;
  }

  .booking-footer span {
    color: #88a68d;
    font-size: 15px;
  }

  .booking-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #657669;
    font-size: 14px;
  }

  .booking-loading p {
    margin: 0;
  }

  .paw-decoration {
    color: var(--green);
    font-size: 42px;
  }

  @media (max-width: 700px) {
    .booking-page {
      padding: 0 14px;
    }

    .booking-header {
      min-height: 76px;
      gap: 12px;
    }

    .booking-brand {
      gap: 9px;
    }

    .booking-brand-mark {
      width: 41px;
      height: 41px;
      border-radius: 13px;
      font-size: 22px;
    }

    .booking-brand-copy strong {
      font-size: 16px;
    }

    .booking-brand-copy small {
      max-width: 170px;
      font-size: 10px;
    }

    .booking-back-link {
      padding: 9px 11px;
      font-size: 11px;
      white-space: nowrap;
    }

    .booking-intro {
      margin-top: 20px;
      padding: 30px 23px;
      border-radius: 20px;
    }

    .booking-intro h1 {
      max-width: 390px;
      font-size: 34px;
      letter-spacing: -1.3px;
    }

    .booking-intro > p {
      font-size: 13px;
      line-height: 1.75;
    }

    .intro-paw {
      top: 14px;
      right: 8px;
      font-size: 75px;
    }

    .intro-details {
      flex-direction: column;
      gap: 9px;
      font-size: 11px;
    }

    .booking-form {
      gap: 14px;
    }

    .booking-form-heading {
      align-items: flex-start;
      padding-top: 10px;
    }

    .booking-form-heading h2,
    .booking-notes-panel h2 {
      font-size: 20px;
    }

    .booking-count {
      padding: 8px 10px;
      font-size: 10px;
    }

    .booking-service-card,
    .booking-notes-panel {
      padding: 19px;
      border-radius: 17px;
    }

    .booking-service-heading {
      gap: 10px;
      padding-bottom: 18px;
      margin-bottom: 19px;
    }

    .booking-service-number {
      width: 39px;
      height: 39px;
      border-radius: 12px;
      font-size: 12px;
    }

    .booking-service-heading h3 {
      font-size: 15px;
    }

    .booking-service-heading p {
      font-size: 11px;
      line-height: 1.5;
    }

    .booking-remove-button {
      padding: 7px 9px;
      font-size: 11px;
    }

    .booking-field-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 17px;
    }

    .booking-field input,
    .booking-field select,
    .booking-field textarea {
      font-size: 16px;
    }

    .booking-medication-panel {
      padding: 14px;
      margin-top: 19px;
    }

    .booking-service-price {
      padding: 14px;
      gap: 10px;
    }

    .booking-service-price > strong {
      font-size: 17px;
    }

    .booking-summary {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
      padding: 21px;
    }

    .summary-total {
      align-items: flex-start;
      padding: 17px 0 0;
      border-left: 0;
      border-top: 1px solid #dbe7da;
    }

    .booking-submit-row {
      flex-direction: column;
      align-items: stretch;
      gap: 17px;
    }

    .booking-submit-row p {
      max-width: none;
    }

    .booking-primary-button {
      width: 100%;
    }

    .booking-empty-pets {
      padding: 37px 20px;
    }

    .booking-empty-pets h2 {
      font-size: 23px;
    }

    .booking-footer {
      gap: 7px;
      padding: 27px 0 22px;
      font-size: 10px;
    }

    .paw-pattern-top {
      right: -40px;
      font-size: 85px;
    }

    .paw-pattern-side {
      left: -45px;
      font-size: 70px;
    }
  }

  @media (max-width: 390px) {
    .booking-brand-copy small {
      max-width: 135px;
    }

    .booking-back-link {
      padding: 8px;
      gap: 5px;
      font-size: 10px;
    }

    .booking-intro h1 {
      font-size: 30px;
    }

    .booking-form-heading {
      flex-direction: column;
      gap: 10px;
    }

    .booking-remove-button {
      padding: 7px;
    }
  }
`;
