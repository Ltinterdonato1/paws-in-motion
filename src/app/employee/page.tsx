"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Brand from "@/components/Brand";

type EmployeeProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
};

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployee = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, phone, role")
        .eq("id", user.id)
        .single();

      if (profileError || !data) {
        throw new Error("We couldn't load your employee profile.");
      }

      if (data.role !== "employee" && data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setProfile({
        full_name: data.full_name,
        email: data.email ?? user.email ?? null,
        phone: data.phone,
        role: data.role,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong loading your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadEmployee();
  }, [loadEmployee]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>
          Loading your employee portal...
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.topbar}>
        <Brand className="brand" subtitle="EMPLOYEE PORTAL" />

        <div style={styles.topActions}>
          <span style={styles.employeeBadge}>
            {profile?.role === "admin" ? "Administrator" : "Employee"}
          </span>

          <button
            type="button"
            style={styles.signOutButton}
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={styles.content}>
        {/* Welcome and signed-in account information */}
        <section style={styles.welcome}>
          <div style={styles.welcomeContent}>
            <p style={styles.eyebrow}>YOUR WORKSPACE</p>

            <h1 style={styles.heading}>
              Welcome back
              {profile?.full_name ? `, ${profile.full_name}` : ""}!
            </h1>

            <p style={styles.subtitle}>
              Welcome to your Paws in Motion employee workspace.
              Your assigned jobs and schedule will appear here.
            </p>

            <div style={styles.accountInfo}>
              <div style={styles.profileAvatar}>
                {(
                  profile?.full_name?.trim()?.charAt(0) || "E"
                ).toUpperCase()}
              </div>

              <div style={styles.accountDetails}>
                <p style={styles.accountEyebrow}>SIGNED-IN ACCOUNT</p>

                

                <p style={styles.profileDetail}>
                  {profile?.email || "No email available"}
                </p>

                {profile?.phone && (
                  <p style={styles.profileDetail}>{profile.phone}</p>
                )}
              </div>

              <span style={styles.accountRole}>
                {profile?.role === "admin" ? "Administrator" : "Team member"}
              </span>
            </div>
          </div>

          
        </section>

        {error && (
          <section role="alert" style={styles.error}>
            <p style={{ margin: 0 }}>{error}</p>

            <button
              type="button"
              onClick={() => void loadEmployee()}
              style={styles.retryButton}
            >
              Try again
            </button>
          </section>
        )}

        {/* Job overview */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>YOUR WORK</p>
              <h2 style={styles.sectionTitle}>Job overview</h2>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <article style={styles.statCard}>
              <div style={styles.statIcon}>📋</div>
              <p style={styles.statLabel}>Assigned jobs</p>
              <p style={styles.statValue}>—</p>
              <p style={styles.statHint}>Your assigned bookings</p>
            </article>

            <article style={styles.statCard}>
              <div style={styles.statIcon}>📅</div>
              <p style={styles.statLabel}>Upcoming</p>
              <p style={styles.statValue}>—</p>
              <p style={styles.statHint}>Jobs coming up</p>
            </article>

            <article style={styles.statCard}>
              <div style={styles.statIcon}>✅</div>
              <p style={styles.statLabel}>Completed</p>
              <p style={styles.statValue}>—</p>
              <p style={styles.statHint}>Finished jobs</p>
            </article>
          </div>
        </section>

        {/* Quick links */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.eyebrow}>STAY ORGANIZED</p>
              <h2 style={styles.sectionTitle}>Quick links</h2>
            </div>
          </div>

          <div style={styles.linksGrid}>
            <button
              type="button"
              style={styles.linkCard}
              onClick={() => router.push("/employee/jobs")}
            >
              <span style={styles.linkIcon}>🐾</span>

              <span style={styles.linkText}>
                <strong>My Assigned Jobs</strong>
                <span style={styles.linkDescription}>
                  View the work assigned to you
                </span>
              </span>

              <span style={styles.arrow}>→</span>
            </button>

            <button
              type="button"
              style={styles.linkCard}
              onClick={() => router.push("/employee/invoices")}
            >
              <span style={styles.linkIcon}>🧾</span>

              <span style={styles.linkText}>
                <strong>Invoices</strong>
                <span style={styles.linkDescription}>
                  Access job-related invoices
                </span>
              </span>

              <span style={styles.arrow}>→</span>
            </button>

            <button
              type="button"
              style={styles.linkCard}
              onClick={() => router.push("/employee/profile")}
            >
              <span style={styles.linkIcon}>👤</span>

              <span style={styles.linkText}>
                <strong>My Profile</strong>
                <span style={styles.linkDescription}>
                  Review your account information
                </span>
              </span>

              <span style={styles.arrow}>→</span>
            </button>
          </div>
        </section>

        <footer style={styles.footer}>
          <span>🐾 Paws in Motion</span>
          <span>Employee Portal</span>
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

  paw: {
    fontSize: 34,
  },

  brandName: {
    display: "block",
    fontSize: 20,
    letterSpacing: "-0.5px",
  },

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
  },

  employeeBadge: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 20,
    background: "#e5f2e9",
    color: "#326447",
    fontSize: 12,
    fontWeight: 700,
  },

  signOutButton: {
    padding: "10px 15px",
    background: "#fff",
    border: "1px solid #d8e1db",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 600,
    color: "#34473b",
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

  welcomeContent: {
    flex: 1,
    minWidth: 0,
  },

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

  accountDetails: {
    flex: 1,
    minWidth: 180,
  },

  accountEyebrow: {
    margin: "0 0 5px",
    color: "#5a8069",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.5,
  },

  profileName: {
    margin: "0 0 6px",
    fontSize: 18,
  },

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

  welcomePaw: {
    fontSize: 64,
    flexShrink: 0,
  },

  section: {
    marginTop: 34,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.4px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 16,
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e5eae6",
    borderRadius: 16,
    padding: 22,
    boxShadow: "0 3px 12px rgba(30, 60, 42, 0.03)",
  },

  statIcon: {
    fontSize: 24,
  },

  statLabel: {
    margin: "16px 0 0",
    color: "#617067",
    fontSize: 13,
  },

  statValue: {
    margin: "6px 0",
    fontSize: 32,
    fontWeight: 800,
  },

  statHint: {
    margin: 0,
    color: "#89958e",
    fontSize: 12,
  },

  linksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },

  linkCard: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: 18,
    border: "1px solid #e1e8e3",
    borderRadius: 14,
    background: "#fff",
    color: "#23332d",
    cursor: "pointer",
    textAlign: "left",
  },

  linkIcon: {
    display: "grid",
    placeItems: "center",
    width: 44,
    height: 44,
    flexShrink: 0,
    background: "#edf5ef",
    borderRadius: 12,
    fontSize: 22,
  },

  linkText: {
    display: "grid",
    gap: 5,
    flex: 1,
  },

  linkDescription: {
    color: "#758178",
    fontSize: 12,
  },

  arrow: {
    color: "#56816b",
    fontSize: 22,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 34,
    padding: "18px 0 8px",
    borderTop: "1px solid #dfe6e1",
    color: "#77847b",
    fontSize: 12,
  },

  error: {
    marginTop: 20,
    padding: 16,
    background: "#fff0ee",
    border: "1px solid #f1c7c2",
    borderRadius: 12,
    color: "#9a3026",
  },

  retryButton: {
    marginTop: 12,
    padding: "8px 12px",
    border: "1px solid #d9a19a",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  },
};
