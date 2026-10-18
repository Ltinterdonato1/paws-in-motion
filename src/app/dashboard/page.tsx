
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import Brand from "@/components/Brand";

type Pet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  notes: string | null;
  photo_path: string | null;
  photoUrl?: string | null;
};

type Booking = {
  id: string;
  service_name: string;
  booking_date: string;
  status: "pending" | "approved" | "completed" | "cancelled";
  pet_id: string | null;
};

type BookingService = {
  booking_id: string;
  service_name: string | null;
  service_start: string;
  service_end: string;
};

const emptyPet = {
  name: "",
  species: "Dog",
  breed: "",
  notes: "",
};

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getPhotoExtension(file: File) {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();

  const [pets, setPets] = useState<Pet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingServices, setBookingServices] = useState<
    Record<string, BookingService[]>
  >({});
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petForm, setPetForm] = useState(emptyPet);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(
    null
  );
  const [removePhoto, setRemovePhoto] = useState(false);

  const editingPet = pets.find((pet) => pet.id === editingPetId);

  // Only show active bookings in the main customer schedule.
  const visibleBookings = bookings.filter(
    (booking) => booking.status !== "cancelled"
  );

  // Create a temporary preview for the selected local image.
  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedPhoto]);

  const loadDashboard = useCallback(async () => {
    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const user = authData.user;

    setFullName(
      user.user_metadata?.full_name ||
        user.email ||
        "Pet parent"
    );

    const [petsResult, bookingsResult] = await Promise.all([
      supabase
        .from("pets")
        .select("id, name, species, breed, notes, photo_path")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("bookings")
        .select("id, service_name, booking_date, status, pet_id")
        .eq("customer_id", user.id)
        .order("booking_date", { ascending: true }),
    ]);

    if (petsResult.error || bookingsResult.error) {
      setErrorMessage(
        petsResult.error?.message ||
          bookingsResult.error?.message ||
          "Unable to load your dashboard."
      );
      setLoading(false);
      return;
    }

    // The bucket is private, so generate temporary URLs for display.
    const petsWithPhotos = await Promise.all(
      (petsResult.data || []).map(async (pet) => {
        if (!pet.photo_path) {
          return { ...pet, photoUrl: null };
        }

        const { data, error } = await supabase.storage
          .from("pet-photos")
          .createSignedUrl(pet.photo_path, 60 * 60);

        return {
          ...pet,
          photoUrl: error ? null : data.signedUrl,
        };
      })
    );

    setPets(petsWithPhotos);

    const bookingRows = (bookingsResult.data || []) as Booking[];

    if (bookingRows.length > 0) {
      const { data: serviceRows, error: serviceError } = await supabase
        .from("booking_services")
        .select("booking_id, service_name, service_start, service_end")
        .in(
          "booking_id",
          bookingRows.map((booking) => booking.id)
        )
        .order("service_start", { ascending: true });

      if (serviceError) {
        console.error("Unable to load booking service times:", serviceError);
        setErrorMessage(
          "Your bookings loaded, but we couldn't load all appointment times."
        );
        setBookingServices({});
      } else {
        const servicesByBooking: Record<string, BookingService[]> = {};

        for (const service of (serviceRows || []) as BookingService[]) {
          if (!servicesByBooking[service.booking_id]) {
            servicesByBooking[service.booking_id] = [];
          }

          servicesByBooking[service.booking_id].push(service);
        }

        setBookingServices(servicesByBooking);
      }

      setBookings(bookingRows);
    } else {
      setBookings([]);
      setBookingServices({});
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  function resetPetForm() {
    setShowPetForm(false);
    setEditingPetId(null);
    setPetForm(emptyPet);
    setSelectedPhoto(null);
    setRemovePhoto(false);
  }

  function startAddingPet() {
    setEditingPetId(null);
    setPetForm(emptyPet);
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setMessage("");
    setErrorMessage("");
    setShowPetForm(true);
  }

  function startEditingPet(pet: Pet) {
    setEditingPetId(pet.id);
    setPetForm({
      name: pet.name,
      species: pet.species || "Dog",
      breed: pet.breed || "",
      notes: pet.notes || "",
    });
    setSelectedPhoto(null);
    setRemovePhoto(false);
    setMessage("");
    setErrorMessage("");
    setShowPetForm(true);
  }

  function handlePhotoChange(file: File | null) {
    setErrorMessage("");

    if (!file) {
      setSelectedPhoto(null);
      return;
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setErrorMessage("Please choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setErrorMessage(
        "That photo is too large. Please choose an image under 5 MB."
      );
      return;
    }

    setSelectedPhoto(file);
    setRemovePhoto(false);
  }

  async function uploadPetPhoto(
    supabase: ReturnType<typeof createClient>,
    userId: string,
    petId: string,
    file: File
  ) {
    const extension = getPhotoExtension(file);

    if (!extension) {
      return {
        path: null,
        error: "Please choose a JPEG, PNG, or WebP image.",
      };
    }

    const path = `${userId}/${petId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const { error } = await supabase.storage
      .from("pet-photos")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return { path: null, error: error.message };
    }

    return { path, error: null };
  }

  async function savePet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setErrorMessage("Your session has expired. Please log in again.");
      setSaving(false);
      router.replace("/login");
      return;
    }

    const user = authData.user;

    const petData = {
      name: petForm.name.trim(),
      species: petForm.species.trim() || null,
      breed: petForm.breed.trim() || null,
      notes: petForm.notes.trim() || null,
    };

    // EDIT AN EXISTING PET
    if (editingPetId) {
      const existingPet = pets.find(
        (pet) => pet.id === editingPetId
      );

      if (!existingPet) {
        setErrorMessage("We couldn't find that pet. Please refresh.");
        setSaving(false);
        return;
      }

      let photoPathToSave = removePhoto
        ? null
        : existingPet.photo_path;

      let newlyUploadedPath: string | null = null;

      if (selectedPhoto) {
        const uploadResult = await uploadPetPhoto(
          supabase,
          user.id,
          editingPetId,
          selectedPhoto
        );

        if (uploadResult.error || !uploadResult.path) {
          setErrorMessage(
            `The photo could not be uploaded: ${
              uploadResult.error || "Unknown error"
            }`
          );
          setSaving(false);
          return;
        }

        newlyUploadedPath = uploadResult.path;
        photoPathToSave = uploadResult.path;
      }

      const { data, error } = await supabase
        .from("pets")
        .update({
          ...petData,
          photo_path: photoPathToSave,
        })
        .eq("id", editingPetId)
        .eq("owner_id", user.id)
        .select("id");

      if (error || !data?.length) {
        if (newlyUploadedPath) {
          await supabase.storage
            .from("pet-photos")
            .remove([newlyUploadedPath]);
        }

        setErrorMessage(
          error?.message ||
            "We couldn't save your changes. Please try again."
        );
        setSaving(false);
        return;
      }

      if (
        existingPet.photo_path &&
        existingPet.photo_path !== photoPathToSave
      ) {
        await supabase.storage
          .from("pet-photos")
          .remove([existingPet.photo_path]);
      }

      setMessage(`${petData.name}’s details were updated!`);
      resetPetForm();
      await loadDashboard();
      setSaving(false);
      return;
    }

    // ADD A NEW PET
    const { data: newPetData, error: insertError } = await supabase
      .from("pets")
      .insert({
        ...petData,
        owner_id: user.id,
        photo_path: null,
      })
      .select("id")
      .single();

    if (insertError || !newPetData) {
      setErrorMessage(
        insertError?.message ||
          "We couldn't add your pet. Please try again."
      );
      setSaving(false);
      return;
    }

    if (!selectedPhoto) {
      setMessage(`${petData.name} was added to your pet list!`);
      resetPetForm();
      await loadDashboard();
      setSaving(false);
      return;
    }

    const uploadResult = await uploadPetPhoto(
      supabase,
      user.id,
      newPetData.id,
      selectedPhoto
    );

    if (uploadResult.error || !uploadResult.path) {
      setMessage(
        `${petData.name} was added, but the photo could not be uploaded. You can edit the pet and try again.`
      );
      resetPetForm();
      await loadDashboard();
      setSaving(false);
      return;
    }

    const { error: photoSaveError } = await supabase
      .from("pets")
      .update({ photo_path: uploadResult.path })
      .eq("id", newPetData.id)
      .eq("owner_id", user.id);

    if (photoSaveError) {
      await supabase.storage
        .from("pet-photos")
        .remove([uploadResult.path]);

      setMessage(
        `${petData.name} was added, but we couldn't save its photo. You can edit the pet and try again.`
      );
      resetPetForm();
      await loadDashboard();
      setSaving(false);
      return;
    }

    setMessage(`${petData.name} and their photo were added!`);
    resetPetForm();
    await loadDashboard();
    setSaving(false);
  }

  async function deletePet(pet: Pet) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${pet.name} from your pet list?`
    );

    if (!confirmed) return;

    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("pets")
      .delete()
      .eq("id", pet.id)
      .eq("owner_id", authData.user.id)
      .select("id");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (!data?.length) {
      setErrorMessage("We couldn't delete that pet. Please try again.");
      return;
    }

    if (pet.photo_path) {
      await supabase.storage
        .from("pet-photos")
        .remove([pet.photo_path]);
    }

    setMessage(`${pet.name} was removed from your pet list.`);
    await loadDashboard();
  }

  // Customers may cancel pending or approved bookings.
  async function cancelBooking(booking: Booking) {
    if (
      booking.status !== "pending" &&
      booking.status !== "approved"
    ) {
      return;
    }

    if (cancellingBookingId) return;

    const confirmed = window.confirm(
      `Are you sure you want to cancel your ${booking.service_name} booking?`
    );

    if (!confirmed) return;

    setCancellingBookingId(booking.id);
    setMessage("");
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bookingId: booking.id,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "We couldn't cancel this booking. Please try again."
        );
      }

      setMessage(
        result?.message || "Your booking has been cancelled."
      );

      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't cancel this booking. Please try again."
      );
    } finally {
      setCancellingBookingId(null);
    }
  }

  async function logOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-loading">Loading your dashboard...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand className="account-brand" />

        <button
          type="button"
          className="dashboard-logout"
          onClick={logOut}
        >
          Log out
        </button>
      </header>

      <section className="dashboard-welcome">
        <p className="account-eyebrow">YOUR PERSONAL DASHBOARD</p>
        <h1>Welcome, {fullName}!</h1>
        <p>
          Manage your pets, keep track of bookings, and plan your
          next visit.
        </p>
      </section>

      {(message || errorMessage) && (
        <div
          className={`dashboard-notice ${
            errorMessage ? "dashboard-notice-error" : ""
          }`}
          role={errorMessage ? "alert" : "status"}
        >
          {errorMessage || message}
        </div>
      )}

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <p className="account-eyebrow">YOUR FURRY FAMILY</p>
            <h2>My Pets</h2>
            <p className="dashboard-muted">
              Add a new pet or keep their care details up to date.
            </p>
          </div>

          <button
            type="button"
            className="dashboard-primary-button"
            onClick={startAddingPet}
          >
            + Add a Pet
          </button>
        </div>

        {showPetForm && (
          <form className="pet-form" onSubmit={savePet}>
            <h3>{editingPetId ? "Edit Pet" : "Add a New Pet"}</h3>

            <label htmlFor="pet-name">Pet&apos;s name *</label>
            <input
              id="pet-name"
              value={petForm.name}
              onChange={(event) =>
                setPetForm({ ...petForm, name: event.target.value })
              }
              placeholder="e.g. Bailey"
              required
              maxLength={100}
            />

            <label htmlFor="pet-species">Species</label>
            <select
              id="pet-species"
              value={petForm.species}
              onChange={(event) =>
                setPetForm({ ...petForm, species: event.target.value })
              }
            >
              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Bird">Bird</option>
              <option value="Rabbit">Rabbit</option>
              <option value="Other">Other</option>
            </select>

            <label htmlFor="pet-breed">Breed</label>
            <input
              id="pet-breed"
              value={petForm.breed}
              onChange={(event) =>
                setPetForm({ ...petForm, breed: event.target.value })
              }
              placeholder="e.g. Golden Retriever"
              maxLength={100}
            />

            <div className="pet-photo-field">
              <label htmlFor="pet-photo">Pet photo (optional)</label>
              <p className="pet-photo-help">
                Choose a JPEG, PNG, or WebP image up to 5 MB.
              </p>

              {(photoPreviewUrl ||
                (!removePhoto && editingPet?.photoUrl)) && (
                <div className="pet-photo-preview-wrap">
                  <img
                    src={photoPreviewUrl || editingPet?.photoUrl || ""}
                    alt={`Preview of ${petForm.name || "your pet"}`}
                    className="pet-photo-preview"
                  />
                </div>
              )}

              {editingPetId && editingPet?.photo_path && !removePhoto && (
                <button
                  type="button"
                  className="pet-photo-remove"
                  onClick={() => {
                    setSelectedPhoto(null);
                    setRemovePhoto(true);
                    setErrorMessage("");
                  }}
                >
                  Remove current photo
                </button>
              )}

              {removePhoto && (
                <p className="pet-photo-help">
                  The current photo will be removed when you save.
                </p>
              )}

              <input
                id="pet-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  handlePhotoChange(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
            </div>

            <label htmlFor="pet-notes">
              Care notes and special instructions
            </label>
            <textarea
              id="pet-notes"
              value={petForm.notes}
              onChange={(event) =>
                setPetForm({ ...petForm, notes: event.target.value })
              }
              placeholder="Food, routines, medications, personality, or anything we should know."
              rows={4}
              maxLength={3000}
            />

            <div className="pet-form-actions">
              <button
                type="submit"
                className="dashboard-primary-button"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingPetId
                    ? "Save Changes"
                    : "Add Pet"}
              </button>

              <button
                type="button"
                className="dashboard-secondary-button"
                disabled={saving}
                onClick={resetPetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {pets.length === 0 ? (
          <div className="dashboard-empty">
            <span className="dashboard-paw" aria-hidden="true">
              🐾
            </span>
            <h3>No pets added yet</h3>
            <p>Add your first pet to get started with booking care.</p>
            <button
              type="button"
              className="dashboard-primary-button"
              onClick={startAddingPet}
            >
              Add Your First Pet
            </button>
          </div>
        ) : (
          <div className="pet-grid">
            {pets.map((pet) => (
              <article className="pet-card" key={pet.id}>
                {pet.photoUrl ? (
                  <img
                    src={pet.photoUrl}
                    alt={pet.name}
                    className="pet-card-photo"
                  />
                ) : (
                  <div className="pet-card-icon" aria-hidden="true">
                    🐾
                  </div>
                )}

                <h3>{pet.name}</h3>

                <p className="pet-card-type">
                  {[pet.species, pet.breed].filter(Boolean).join(" · ") ||
                    "Pet"}
                </p>

                {pet.notes && (
                  <p className="pet-card-notes">{pet.notes}</p>
                )}

                <div className="pet-card-actions">
                  <button
                    type="button"
                    className="dashboard-secondary-button"
                    onClick={() => startEditingPet(pet)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="dashboard-delete-button"
                    onClick={() => void deletePet(pet)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <p className="account-eyebrow">CARE SCHEDULE</p>
            <h2>My Bookings</h2>
            <p className="dashboard-muted">
              Keep track of your appointment requests and their status.
            </p>
          </div>

          <Link
            href="/book"
            className="dashboard-primary-button dashboard-link-button"
          >
            Request a Booking
          </Link>
        </div>

        {visibleBookings.length === 0 ? (
          <div className="dashboard-empty">
            <span className="dashboard-paw" aria-hidden="true">
              📅
            </span>
            <h3>No active bookings</h3>
            <p>
              Your pending and approved booking requests will appear here.
              Cancelled bookings are hidden from this schedule.
            </p>
            <Link
              href="/book"
              className="dashboard-primary-button dashboard-link-button"
            >
              Explore Booking Options
            </Link>
          </div>
        ) : (
          <div className="booking-list">
            {visibleBookings.map((booking) => {
              const pet = pets.find(
                (item) => item.id === booking.pet_id
              );

              const firstService = bookingServices[booking.id]?.[0];
              const scheduledTime =
                firstService?.service_start ?? booking.booking_date;

              return (
                <article className="booking-card" key={booking.id}>
                  <div>
                    <h3>{booking.service_name}</h3>
                    <p>
                      {new Date(scheduledTime).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Los_Angeles",
                      })}
                    </p>
                    {pet && <p>For {pet.name}</p>}
                  </div>

                  <div className="booking-card-actions">
                    <span
                      className={`booking-status booking-status-${booking.status}`}
                    >
                      {booking.status.charAt(0).toUpperCase() +
                        booking.status.slice(1)}
                    </span>

                    {(booking.status === "pending" ||
                      booking.status === "approved") && (
                      <button
                        type="button"
                        className="dashboard-delete-button"
                        onClick={() => void cancelBooking(booking)}
                        disabled={cancellingBookingId !== null}
                      >
                        {cancellingBookingId === booking.id
                          ? "Cancelling..."
                          : "Cancel Booking"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="dashboard-footer">
        <Link href="/">Back to Paws in Motion</Link>
      </footer>
    </main>
  );
}
