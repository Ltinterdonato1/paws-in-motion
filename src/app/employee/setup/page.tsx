
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function EmployeeSetupPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkInvitation() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !session) {
        setIsError(true);
        setMessage(
          "Please open the invitation link from your email again. If it has expired, ask your administrator to send a new invitation."
        );
      }

      setLoading(false);
    }

    void checkInvitation();

    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (password.length < 8) {
      setIsError(true);
      setMessage("Your password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("Your passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Your invitation session has expired. Please reopen your invitation email."
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "employee") {
        throw new Error(
          "This account is not set up as an employee. Please contact your administrator."
        );
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage("Your password has been set. Taking you to your employee dashboard...");

      router.replace("/employee");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to finish setting up your account."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="account-page">
        <section className="account-card">
          <p>Checking your invitation...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <section className="account-card" style={{ maxWidth: 480, width: "100%" }}>
        <p className="account-eyebrow">PAWS IN MOTION</p>
        <h1>Set Up Your Employee Account</h1>
        <p className="account-description">
          Create a password to access your employee dashboard.
        </p>

        {message && (
          <p
            className={`account-message ${
              isError ? "account-message-error" : ""
            }`}
            role="status"
          >
            {message}
          </p>
        )}

        {!isError || message.includes("password") ? (
          <form onSubmit={handleSubmit}>
            <label>
              Create password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "block", marginTop: 16 }}>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                style={fieldStyle}
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              style={{ width: "100%", marginTop: 20 }}
            >
              {saving ? "Setting up account..." : "Set Password"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{ width: "100%" }}
          >
            Go to login
          </button>
        )}
      </section>
    </main>
  );
}

const fieldStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 10,
  marginTop: 6,
  border: "1px solid #ccc",
  borderRadius: 8,
  background: "transparent",
};
