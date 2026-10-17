
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

type Job = {
  id: string;
  service_name: string;
  booking_date: string;
  status: "pending" | "approved" | "completed" | "cancelled";
  request_notes: string | null;
  assigned_employee_id: string | null;
};

type ScheduledService = {
  booking_id: string;
  service_start: string;
  service_end: string;
};

export default function EmployeeJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [serviceTimes, setServiceTimes] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadJobs() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Please sign in to view your assigned jobs.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        setError("We couldn't verify your account.");
        setLoading(false);
        return;
      }

      if (profile.role !== "employee" && profile.role !== "admin") {
        setError("You don't have permission to view employee jobs.");
        setLoading(false);
        return;
      }

      let query = supabase
        .from("bookings")
        .select(
          "id, service_name, booking_date, status, request_notes, assigned_employee_id"
        )
        .in("status", ["pending", "approved"])
        .order("booking_date", { ascending: true });

      if (profile.role === "employee") {
        query = query.eq("assigned_employee_id", user.id);
      }

      const { data, error: jobsError } = await query;

      if (jobsError) {
        console.error("Unable to load jobs:", jobsError);
        setError("We couldn't load your jobs. Please try again.");
        setLoading(false);
        return;
      }

      const loadedJobs = (data ?? []) as Job[];
      setJobs(loadedJobs);

      if (loadedJobs.length > 0) {
        const bookingIds = loadedJobs.map((job) => job.id);

        const { data: services, error: servicesError } = await supabase
          .from("booking_services")
          .select("booking_id, service_start, service_end")
          .in("booking_id", bookingIds)
          .order("service_start", { ascending: true });

        if (servicesError) {
          console.error("Unable to load service times:", servicesError);
          // Keep the booking date as a fallback.
        } else {
          const times: Record<string, string> = {};

          for (const service of (services ?? []) as ScheduledService[]) {
            if (!times[service.booking_id]) {
              times[service.booking_id] = service.service_start;
            }
          }

          setServiceTimes(times);
        }
      }

      setLoading(false);
    }

    void loadJobs();
  }, []);

  const dateLabel = (date: string) =>
    new Date(date).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <main className="min-h-screen bg-[#f8f5ec] px-5 py-10 text-[#193d30] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/employee"
          className="text-sm font-medium text-[#315846] hover:underline"
        >
          ← Back to Employee Portal
        </Link>

        <header className="mb-8 mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#718477]">
            Paws in Motion
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">My Jobs</h1>
          <p className="mt-3 text-[#5d6f63]">
            View assigned bookings and open a job for its details.
          </p>
        </header>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            Loading jobs…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-6 text-red-700"
          >
            {error}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">No active jobs</h2>
            <p className="mt-2 text-[#5d6f63]">
              Pending and approved bookings assigned to you will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <article
                key={job.id}
                className="rounded-2xl border border-[#e6e4d9] bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {job.service_name}
                    </h2>
                    <p className="mt-2 text-sm text-[#5d6f63]">
                      {dateLabel(serviceTimes[job.id] ?? job.booking_date)}
                    </p>

                    {job.request_notes && (
                      <p className="mt-3 text-sm text-[#5d6f63]">
                        {job.request_notes}
                      </p>
                    )}
                  </div>

                  <span className="w-fit rounded-full bg-[#edf2e9] px-3 py-1 text-sm font-medium capitalize">
                    {job.status}
                  </span>
                </div>

                <div className="mt-5">
                  <Link
                    href={`/employee/jobs/${job.id}`}
                    className="inline-flex rounded-xl bg-[#193d30] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#315846]"
                  >
                    View Job Details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
