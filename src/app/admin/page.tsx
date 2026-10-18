
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Brand from "@/components/Brand";
import CompleteJobButton from "../employee/jobs/[id]/CompleteJobButton";

type Booking = {
  id: string;
  customer_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  service_name: string | null;
  booking_date: string;
  status: string;
  request_notes: string | null;
  assigned_employee_id: string | null;
  estimated_total: number | string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  role: string;
};

type ProfileDraft = {
  fullName: string;
  email: string;
  phone: string;
};

type BookingService = {
  booking_id: string;
  service_name: string | null;
  service_start: string;
  service_end: string;
  service_option: string | null;
  service_notes: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [supabase, setSupabase] = useState<
    ReturnType<typeof createClient> | null
  >(null);

  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingServices, setBookingServices] = useState<
    Record<string, BookingService[]>
  >({});
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [administrators, setAdministrators] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Record<string, Profile>>({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    fullName: "",
    email: "",
    phone: "",
  });

  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeTemporaryPassword, setEmployeeTemporaryPassword] =
    useState("");
  const [newAccountRole, setNewAccountRole] = useState("employee");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Create the Supabase browser client after the component mounts.
  // This prevents Next.js from trying to create it while prerendering /admin.
  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to initialize Supabase. Check your environment variables."
      );
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile || profile.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setAdminProfile({
        ...profile,
        email: profile.email ?? user.email ?? null,
      });

      const [bookingResult, teamResult] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, customer_id, guest_name, guest_email, guest_phone, service_name, booking_date, status, request_notes, assigned_employee_id, estimated_total"
          )
          .order("booking_date", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name, email, phone, role")
          .in("role", ["employee", "admin"])
          .order("full_name", { ascending: true }),
      ]);

      if (bookingResult.error) throw bookingResult.error;
      if (teamResult.error) throw teamResult.error;

      const bookingRows = (bookingResult.data ?? []) as Booking[];
      const teamRows = (teamResult.data ?? []) as Profile[];

      setBookings(bookingRows);

      // Fetch the actual appointment times for each booking.
      if (bookingRows.length > 0) {
        const bookingIds = bookingRows.map((booking) => booking.id);

        const { data: serviceRows, error: serviceError } = await supabase
          .from("booking_services")
          .select("booking_id, service_name, service_option, service_notes, service_start, service_end")
          .in("booking_id", bookingIds)
          .order("service_start", { ascending: true });

        if (serviceError) throw serviceError;

        const servicesByBooking: Record<string, BookingService[]> = {};

        for (const service of (serviceRows ?? []) as BookingService[]) {
          if (!servicesByBooking[service.booking_id]) {
            servicesByBooking[service.booking_id] = [];
          }

          servicesByBooking[service.booking_id].push(service);
        }

        setBookingServices(servicesByBooking);
      } else {
        setBookingServices({});
      }

      setEmployees(teamRows.filter((member) => member.role === "employee"));
      setAdministrators(teamRows.filter((member) => member.role === "admin"));

      const customerIds = [
        ...new Set(bookingRows.map((booking) => booking.customer_id)),
      ].filter((id): id is string => Boolean(id));

      if (customerIds.length > 0) {
        const { data: customerRows, error: customerError } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", customerIds);

        if (customerError) throw customerError;

        const customerMap: Record<string, Profile> = {};

        for (const customer of (customerRows ?? []) as Profile[]) {
          customerMap[customer.id] = customer;
        }

        setCustomers(customerMap);
      } else {
        setCustomers({});
      }
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the admin dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    if (supabase) {
      void loadData();
    }
  }, [supabase, loadData]);

  async function callEmployeeApi(
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, string>
  ) {
    if (!supabase) {
      throw new Error("Supabase is still initializing. Please try again.");
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const response = await fetch("/api/admin/employees", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Account request failed.");
    }

    return result;
  }

  async function createEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingEmployee(true);
    setMessage("");
    setIsError(false);

    try {
      const result = await callEmployeeApi("POST", {
        fullName: employeeName,
        email: employeeEmail,
        phone: employeePhone,
        temporaryPassword: employeeTemporaryPassword,
        role: newAccountRole,
      });

      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeePhone("");
      setEmployeeTemporaryPassword("");
      setNewAccountRole("employee");

      setMessage(
        result.message ||
          "Team account created successfully. The team member can now sign in with the temporary password."
      );

      await loadData();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the account."
      );
    } finally {
      setCreatingEmployee(false);
    }
  }

  function startEditing(member: Profile) {
    setEditingProfileId(member.id);
    setProfileDraft({
      fullName: member.full_name || "",
      email: member.email || "",
      phone: member.phone || "",
    });
    setMessage("");
    setIsError(false);
  }

  function cancelEditing() {
    setEditingProfileId(null);
    setProfileDraft({ fullName: "", email: "", phone: "" });
  }

  async function saveProfile(member: Profile) {
    setSavingId(member.id);
    setMessage("");
    setIsError(false);

    try {
      const result = await callEmployeeApi("PATCH", {
        action: "edit-profile",
        employeeId: member.id,
        fullName: profileDraft.fullName,
        email: profileDraft.email,
        phone: profileDraft.phone,
      });

      setEditingProfileId(null);
      setProfileDraft({ fullName: "", email: "", phone: "" });
      setMessage(
        result.message || "Team member details updated successfully."
      );

      await loadData();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update team member details."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function promoteEmployee(employee: Profile) {
    const name = employee.full_name || employee.email || "this employee";

    if (
      !window.confirm(
        `Promote ${name} to administrator? They will have administrator-level access.`
      )
    ) {
      return;
    }

    setSavingId(employee.id);
    setMessage("");
    setIsError(false);

    try {
      const result = await callEmployeeApi("PATCH", {
        action: "promote",
        employeeId: employee.id,
      });

      setMessage(result.message || "Employee promoted to administrator.");
      await loadData();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Unable to promote employee."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTeamMember(member: Profile, isEmployee: boolean) {
    const name = member.full_name || member.email || "this team member";
    const accountType = isEmployee ? "employee" : "administrator";

    const warning = isEmployee
      ? `Permanently delete ${name}'s employee account? They will no longer be able to sign in, and their assigned bookings will become unassigned. This cannot be undone.`
      : `Permanently delete ${name}'s administrator account? They will lose admin access and will no longer be able to sign in. You cannot delete the last administrator. This cannot be undone.`;

    if (!window.confirm(warning)) return;

    setSavingId(member.id);
    setMessage("");
    setIsError(false);

    try {
      const result = await callEmployeeApi("DELETE", {
        employeeId: member.id,
      });

      setMessage(
        result.message || `${accountType} account deleted successfully.`
      );

      await loadData();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : `Unable to delete ${accountType} account.`
      );
    } finally {
      setSavingId(null);
    }
  }

  async function updateBooking(
    bookingId: string,
    changes: {
      status?: string;
      assigned_employee_id?: string | null;
    }
  ) {
    if (!supabase) {
      setIsError(true);
      setMessage("Supabase is still initializing. Please try again.");
      return;
    }

    setSavingId(bookingId);
    setMessage("");
    setIsError(false);

    try {
      const { error } = await supabase
        .from("bookings")
        .update(changes)
        .eq("id", bookingId);

      if (error) throw error;

      setMessage("Booking updated successfully.");
      await loadData();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this booking."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleLogout() {
    if (!supabase) {
      router.replace("/login");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const pendingCount = bookings.filter(
    (booking) => booking.status === "pending"
  ).length;

  const approvedCount = bookings.filter(
    (booking) => booking.status === "approved"
  ).length;

  const cancelledCount = bookings.filter(
    (booking) => booking.status === "cancelled"
  ).length;

  const teamMembers = [...employees, ...administrators];

  function renderTeamMember(member: Profile, isEmployee: boolean) {
    const isEditing = editingProfileId === member.id;
    const isSaving = savingId === member.id;

    return (
      <article key={member.id} style={styles.card}>
        {isEditing ? (
          <div style={styles.editGrid}>
            <label>
              Full name
              <input
                required
                maxLength={120}
                autoComplete="name"
                value={profileDraft.fullName}
                onChange={(event) =>
                  setProfileDraft((draft) => ({
                    ...draft,
                    fullName: event.target.value,
                  }))
                }
                style={styles.input}
              />
            </label>

            <label>
              Email address
              <input
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={profileDraft.email}
                onChange={(event) =>
                  setProfileDraft((draft) => ({
                    ...draft,
                    email: event.target.value,
                  }))
                }
                style={styles.input}
              />
            </label>

            <label>
              Phone number
              <input
                type="tel"
                maxLength={40}
                autoComplete="tel"
                value={profileDraft.phone}
                onChange={(event) =>
                  setProfileDraft((draft) => ({
                    ...draft,
                    phone: event.target.value,
                  }))
                }
                style={styles.input}
              />
            </label>

            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.primaryButton}
                disabled={isSaving}
                onClick={() => void saveProfile(member)}
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>

              <button
                type="button"
                style={styles.secondaryButton}
                disabled={isSaving}
                onClick={cancelEditing}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.memberHeader}>
              <div style={{ minWidth: 0 }}>
                <h3 style={styles.memberName}>
                  {member.full_name || "Unnamed team member"}
                </h3>
                <p style={styles.detailText}>
                  {member.email || "No email provided"}
                </p>
                <p style={styles.detailText}>
                  {member.phone || "No phone provided"}
                </p>
              </div>

              <span
                style={
                  isEmployee ? styles.employeeBadge : styles.adminBadge
                }
              >
                {isEmployee ? "EMPLOYEE" : "ADMINISTRATOR"}
              </span>
            </div>

            <div style={styles.buttonRow}>
              <button
                type="button"
                style={styles.secondaryButton}
                disabled={savingId !== null}
                onClick={() => startEditing(member)}
              >
                Edit details
              </button>

              {isEmployee && (
                <button
                  type="button"
                  style={styles.secondaryButton}
                  disabled={savingId !== null}
                  onClick={() => void promoteEmployee(member)}
                >
                  {isSaving ? "Processing..." : "Promote to admin"}
                </button>
              )}

              {isEmployee && (
                <button
                  type="button"
                  style={styles.dangerButton}
                  disabled={savingId !== null}
                  onClick={() => void deleteTeamMember(member, true)}
                >
                  {isSaving ? "Processing..." : "Delete employee"}
                </button>
              )}
            </div>
          </>
        )}
      </article>
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>Loading your admin portal...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <Brand className="brand" subtitle="ADMIN PORTAL" />

        <div style={styles.topActions}>
          <span style={styles.adminBadge}>Administrator</span>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={styles.content}>
        <section style={styles.welcome}>
          <div style={styles.welcomeContent}>
            <p style={styles.eyebrow}>YOUR WORKSPACE</p>

            <h1 style={styles.heading}>
              Welcome back
              {adminProfile?.full_name
                ? `, ${adminProfile.full_name}`
                : ""}
              !
            </h1>

            <p style={styles.subtitle}>
              Manage bookings, team members, and day-to-day operations for
              Paws in Motion.
            </p>

            <div style={styles.accountInfo}>
              <div style={styles.profileAvatar}>
                {(
                  adminProfile?.full_name?.trim()?.charAt(0) || "A"
                ).toUpperCase()}
              </div>

              <div style={styles.accountDetails}>
                <p style={styles.accountEyebrow}>SIGNED-IN ACCOUNT</p>
                <h2 style={styles.profileName}>
                  {adminProfile?.full_name || "Administrator"}
                </h2>
                <p style={styles.profileDetail}>
                  {adminProfile?.email || "No email available"}
                </p>
                {adminProfile?.phone && (
                  <p style={styles.profileDetail}>{adminProfile.phone}</p>
                )}
              </div>

              <span style={styles.accountRole}>Administrator</span>
            </div>
          </div>
        </section>

        {message && (
          <section
            role={isError ? "alert" : "status"}
            style={isError ? styles.error : styles.success}
          >
            <p style={{ margin: 0 }}>{message}</p>
            {isError && (
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => void loadData()}
              >
                Try again
              </button>
            )}
          </section>
        )}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>AT A GLANCE</p>
              <h2 style={styles.sectionTitle}>Booking overview</h2>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => void loadData()}
            >
              Refresh dashboard
            </button>
          </div>

          <div style={styles.statsGrid}>
            <article style={styles.statCard}>
              <div style={styles.statIcon}>📋</div>
              <p style={styles.statLabel}>All bookings</p>
              <p style={styles.statValue}>{bookings.length}</p>
              <p style={styles.statHint}>Every booking request</p>
            </article>

            <article style={styles.statCard}>
              <div style={styles.statIcon}>⏳</div>
              <p style={styles.statLabel}>Pending</p>
              <p style={styles.statValue}>{pendingCount}</p>
              <p style={styles.statHint}>Awaiting action</p>
            </article>

            <article style={styles.statCard}>
              <div style={styles.statIcon}>✅</div>
              <p style={styles.statLabel}>Approved</p>
              <p style={styles.statValue}>{approvedCount}</p>
              <p style={styles.statHint}>Approved bookings</p>
            </article>

            <article style={styles.statCard}>
              <div style={styles.statIcon}>↩️</div>
              <p style={styles.statLabel}>Cancelled</p>
              <p style={styles.statValue}>{cancelledCount}</p>
              <p style={styles.statHint}>Cancelled requests</p>
            </article>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>YOUR PEOPLE</p>
              <h2 style={styles.sectionTitle}>Team management</h2>
            </div>
          </div>

          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Create a team account</h3>
            <p style={styles.panelDescription}>
              Create an employee or administrator account. Give the team
              member their temporary password securely so they can sign in.
            </p>

            <form onSubmit={createEmployee} style={styles.formGrid}>
              <label>
                Full name
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  placeholder="Full name"
                  style={styles.input}
                />
              </label>

              <label>
                Email address
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={employeeEmail}
                  onChange={(event) => setEmployeeEmail(event.target.value)}
                  placeholder="person@example.com"
                  style={styles.input}
                />
              </label>

              <label>
                Phone number
                <input
                  required
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  value={employeePhone}
                  onChange={(event) => setEmployeePhone(event.target.value)}
                  placeholder="Phone number"
                  style={styles.input}
                />
              </label>

              <label>
                Temporary password
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={employeeTemporaryPassword}
                  onChange={(event) =>
                    setEmployeeTemporaryPassword(event.target.value)
                  }
                  placeholder="At least 8 characters"
                  style={styles.input}
                />
              </label>

              <label>
                Account type
                <select
                  value={newAccountRole}
                  onChange={(event) => setNewAccountRole(event.target.value)}
                  style={styles.input}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>

              <div style={{ display: "flex", alignItems: "end" }}>
                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={creatingEmployee}
                >
                  {creatingEmployee ? "Creating account..." : "Create account"}
                </button>
              </div>
            </form>

            <p style={styles.helperText}>
              Share temporary passwords securely. Never reuse your own
              password.
            </p>
          </div>

          <div style={styles.subsection}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.subsectionTitle}>
                Employees ({employees.length})
              </h3>
            </div>

            {employees.length === 0 ? (
              <div style={styles.emptyState}>
                No employee accounts found yet.
              </div>
            ) : (
              <div style={styles.memberGrid}>
                {employees.map((employee) =>
                  renderTeamMember(employee, true)
                )}
              </div>
            )}
          </div>

          <div style={styles.subsection}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.subsectionTitle}>
                Administrators ({administrators.length})
              </h3>
            </div>

            <p style={styles.panelDescription}>
              Administrators can access this dashboard and manage the business.
            </p>

            {administrators.length === 0 ? (
              <div style={styles.emptyState}>
                No administrator accounts found.
              </div>
            ) : (
              <div style={styles.memberGrid}>
                {administrators.map((administrator) =>
                  renderTeamMember(administrator, false)
                )}
              </div>
            )}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>CUSTOMER REQUESTS</p>
              <h2 style={styles.sectionTitle}>Booking management</h2>
            </div>
          </div>

          {bookings.length === 0 ? (
            <div style={styles.emptyState}>No bookings found.</div>
          ) : (
            <div style={styles.bookingGrid}>
              {bookings.map((booking) => {
                const customer = booking.customer_id
                  ? customers[booking.customer_id]
                  : undefined;
                const assignedEmployee = teamMembers.find(
                  (member) => member.id === booking.assigned_employee_id
                );

                const cancelled = booking.status === "cancelled";
                const completed = booking.status === "completed";

                return (
                  <article key={booking.id} style={styles.card}>
                    <div style={styles.bookingHeader}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={styles.bookingTitle}>
                          {booking.service_name || "Pet care service"}
                        </h3>
                        <p style={styles.detailText}>
                          Customer:{" "}
                          {customer?.full_name ||
                            booking.guest_name ||
                            customer?.email ||
                            booking.guest_email ||
                            "Customer"}
                        </p>
                        {(booking.guest_email || customer?.email) && (
                          <p style={styles.detailText}>
                            Email: {customer?.email || booking.guest_email}
                          </p>
                        )}
                        {booking.guest_phone && (
                          <p style={styles.detailText}>Phone: {booking.guest_phone}</p>
                        )}
                      </div>

                      <span
                        style={
                          cancelled
                            ? styles.cancelledBadge
                            : completed
                              ? styles.completedBadge
                              : booking.status === "approved"
                                ? styles.approvedBadge
                                : styles.pendingBadge
                        }
                      >
                        {booking.status.replaceAll("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <div style={styles.bookingDetails}>
                      <p style={styles.detailText}>
                        <strong>Appointment time:</strong>
                        {bookingServices[booking.id]?.length ? (
                          bookingServices[booking.id].map((service, index) => (
                            <span
                              key={`${booking.id}-${service.service_start}-${index}`}
                              style={{ display: "block", marginTop: 6 }}
                            >
                              {service.service_name ||
                                booking.service_name ||
                                "Pet care service"}
                              {service.service_option ? ` · ${service.service_option}` : ""}
                              {" — "}
                              {new Date(service.service_start).toLocaleString(
                                "en-US",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "America/Los_Angeles",
                                }
                              )}
                              {" – "}
                              {new Date(service.service_end).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  timeZone: "America/Los_Angeles",
                                }
                              )}
                            </span>
                          ))
                        ) : (
                          " Time unavailable"
                        )}
                      </p>

                      <p style={styles.detailText}>
                        <strong>Estimated total:</strong>{" "}
                        {booking.estimated_total == null
                          ? "Not available"
                          : `$${Number(booking.estimated_total).toFixed(2)}`}
                      </p>

                      {booking.request_notes && (
                        <p style={{ ...styles.detailText, whiteSpace: "pre-wrap" }}>
                          <strong>Request details:</strong>{" "}
                          {booking.request_notes}
                        </p>
                      )}

                      <p style={styles.detailText}>
                        <strong>Assigned team member:</strong>{" "}
                        {assignedEmployee?.full_name ||
                          assignedEmployee?.email ||
                          "Not assigned"}
                        {assignedEmployee?.role === "admin"
                          ? " (Administrator)"
                          : ""}
                      </p>
                    </div>

                    <div style={styles.bookingControls}>
                      <label>
                        Assign employee
                        <select
                          value={booking.assigned_employee_id || ""}
                          onChange={(event) =>
                            void updateBooking(booking.id, {
                              assigned_employee_id: event.target.value || null,
                            })
                          }
                          disabled={
                            savingId === booking.id ||
                            cancelled ||
                            completed
                          }
                          style={styles.input}
                        >
                          <option value="">Unassigned</option>

                          <optgroup label="Employees">
                            {employees.map((employee) => (
                              <option key={employee.id} value={employee.id}>
                                {employee.full_name ||
                                  employee.email ||
                                  employee.id}
                              </option>
                            ))}
                          </optgroup>

                          <optgroup label="Administrators">
                            {administrators.map((admin) => (
                              <option key={admin.id} value={admin.id}>
                                {admin.full_name || admin.email || admin.id}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </label>

                      <label>
                        Booking status
                        <select
                          value={booking.status}
                          disabled={
                            savingId === booking.id || cancelled || completed
                          }
                          onChange={(event) =>
                            void updateBooking(booking.id, {
                              status: event.target.value,
                            })
                          }
                          style={styles.input}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          {booking.status === "completed" && (
                            <option value="completed">Completed</option>
                          )}
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>

                      {booking.status === "approved" && (
                        <CompleteJobButton
                          bookingId={booking.id}
                          onCompleted={() => void loadData()}
                        />
                      )}
                    </div>

                    {savingId === booking.id && (
                      <p role="status" style={styles.helperText}>
                        Saving changes...
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer style={styles.footer}>
          <span>🐾 Paws in Motion</span>
          <span>Administrator Portal</span>
        </footer>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7f6",
    color: "#23332d",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  loadingCard: {
    maxWidth: 500,
    margin: "100px auto",
    padding: 32,
    background: "#fff",
    borderRadius: 16,
    textAlign: "center",
  },
  topbar: {
    minHeight: 76,
    padding: "14px 5%",
    background: "#fff",
    borderBottom: "1px solid #e3e9e5",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  brandButton: {
    border: 0,
    background: "transparent",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
    color: "inherit",
  },
  paw: { fontSize: 34 },
  brandName: { display: "block", fontSize: 20, letterSpacing: "-0.5px" },
  brandSubtitle: {
    display: "block",
    marginTop: 4,
    fontSize: 10,
    letterSpacing: 2,
    color: "#56816b",
    fontWeight: 700,
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  employeeBadge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 20,
    background: "#e5f2e9",
    color: "#326447",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  adminBadge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 20,
    background: "#e5f2e9",
    color: "#326447",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    padding: "10px 15px",
    background: "#fff",
    border: "1px solid #d8e1db",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 600,
    color: "#34473b",
  },
  primaryButton: {
    padding: "11px 17px",
    background: "#326447",
    border: "1px solid #326447",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
    color: "#fff",
  },
  dangerButton: {
    padding: "10px 14px",
    background: "#fff",
    border: "1px solid #edcfcb",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 600,
    color: "#a33c32",
  },
  content: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "32px 5% 24px",
  },
  welcome: {
    background: "#e5f0e8",
    border: "1px solid #d7e7dc",
    borderRadius: 20,
    padding: "30px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  welcomeContent: { flex: 1, minWidth: 0 },
  eyebrow: {
    margin: "0 0 8px",
    color: "#5a8069",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.7,
  },
  heading: {
    margin: 0,
    fontSize: "clamp(25px, 4vw, 36px)",
    lineHeight: 1.2,
    letterSpacing: "-1px",
    overflowWrap: "anywhere",
  },
  subtitle: {
    maxWidth: 640,
    margin: "12px 0 0",
    color: "#5d6c63",
    fontSize: 15,
    lineHeight: 1.7,
  },
  accountInfo: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid #c9dccf",
  },
  profileAvatar: {
    width: 54,
    height: 54,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    borderRadius: "50%",
    background: "#dcece1",
    color: "#326447",
    fontSize: 22,
    fontWeight: 800,
  },
  accountDetails: { flex: 1, minWidth: 180 },
  accountEyebrow: {
    margin: "0 0 5px",
    color: "#5a8069",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5,
  },
  profileName: { margin: "0 0 6px", fontSize: 18 },
  profileDetail: {
    margin: "4px 0 0",
    color: "#68766d",
    fontSize: 13,
    overflowWrap: "anywhere",
  },
  accountRole: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 20,
    background: "#fff",
    color: "#326447",
    fontSize: 12,
    fontWeight: 700,
  },
  section: { marginTop: 34 },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: { margin: 0, fontSize: 22, letterSpacing: "-0.4px" },
  subsectionTitle: { margin: 0, fontSize: 18, letterSpacing: "-0.3px" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5eae6",
    borderRadius: 16,
    padding: 22,
    boxShadow: "0 3px 12px rgba(30, 60, 42, 0.03)",
  },
  statIcon: { fontSize: 24 },
  statLabel: { margin: "16px 0 0", color: "#617067", fontSize: 13 },
  statValue: { margin: "6px 0", fontSize: 32, fontWeight: 800 },
  statHint: { margin: 0, color: "#89958e", fontSize: 12 },
  panel: {
    padding: 22,
    background: "#fff",
    border: "1px solid #e5eae6",
    borderRadius: 16,
    boxShadow: "0 3px 12px rgba(30, 60, 42, 0.03)",
  },
  panelTitle: { margin: "0 0 8px", fontSize: 18 },
  panelDescription: {
    margin: "8px 0 16px",
    color: "#68766d",
    fontSize: 13,
    lineHeight: 1.7,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    alignItems: "end",
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: 11,
    marginTop: 6,
    border: "1px solid #d8e1db",
    borderRadius: 9,
    background: "#fff",
    color: "#23332d",
    font: "inherit",
    fontSize: 14,
  },
  helperText: { margin: "12px 0 0", color: "#758178", fontSize: 12 },
  subsection: { marginTop: 30 },
  memberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },
  card: {
    padding: 20,
    background: "#fff",
    border: "1px solid #e3e9e5",
    borderRadius: 16,
    boxShadow: "0 3px 12px rgba(30, 60, 42, 0.025)",
    minWidth: 0,
  },
  memberHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  memberName: { margin: "0 0 8px", fontSize: 17, overflowWrap: "anywhere" },
  detailText: {
    margin: "7px 0 0",
    color: "#68766d",
    fontSize: 13,
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },
  buttonRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 14,
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
  },
  emptyState: {
    padding: 22,
    background: "#fff",
    border: "1px dashed #d8e1db",
    borderRadius: 14,
    color: "#68766d",
    fontSize: 14,
  },
  bookingGrid: { display: "grid", gap: 16 },
  bookingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  bookingTitle: { margin: "0 0 8px", fontSize: 19 },
  bookingDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "4px 18px",
    marginTop: 12,
  },
  bookingControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid #edf0ed",
  },
  pendingBadge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 20,
    background: "#fff4dc",
    color: "#87621a",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  approvedBadge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 20,
    background: "#e5f2e9",
    color: "#326447",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  completedBadge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 20,
    background: "#e6eefb",
    color: "#315a91",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  cancelledBadge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 20,
    background: "#fce9e7",
    color: "#a33c32",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
  },
  error: {
    display: "grid",
    gap: 12,
    marginTop: 20,
    padding: 16,
    background: "#fff0ee",
    border: "1px solid #f1c7c2",
    borderRadius: 12,
    color: "#9a3026",
  },
  success: {
    marginTop: 20,
    padding: 16,
    background: "#eaf5ed",
    border: "1px solid #d0e6d7",
    borderRadius: 12,
    color: "#326447",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 38,
    padding: "18px 0 8px",
    borderTop: "1px solid #dfe6e1",
    color: "#77847b",
    fontSize: 12,
  },
};
