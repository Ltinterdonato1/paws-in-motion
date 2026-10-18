"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Brand from "@/components/Brand";

export default function SignUpPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const supabase = createClient();

      const params = new URLSearchParams(window.location.search);
      const requestedDestination = params.get("next") || "/dashboard";

      // Only permit local paths to avoid external redirects.
      const safeDestination =
        requestedDestination.startsWith("/") &&
        !requestedDestination.startsWith("//")
          ? requestedDestination
          : "/dashboard";

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        // Signup created an active session.
        router.replace(safeDestination);
        router.refresh();
        return;
      }

      // Supabase did not create an active session.
      // This often means email confirmation is enabled.
      setIsError(true);
      setMessage(
        "Your account was submitted, but you are not signed in yet. To sign in immediately after signup, email confirmation must be disabled in your Supabase Email authentication settings."
      );

      // Preserve name, email, and phone so the customer
      // doesn't have to enter them again.
      setPassword("");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <Brand className="account-brand" />

        <p className="account-eyebrow">WELCOME</p>

        <h1>Create your account</h1>

        <p className="account-description">
          Let&apos;s make caring for your pets a little easier.
          Create an account to request visits and manage your bookings.
        </p>

        <form onSubmit={handleSignUp} className="account-form">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="Your phone number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>

          {message && (
            <p
              className={`account-message ${
                isError ? "account-message-error" : ""
              }`}
              role={isError ? "alert" : "status"}
            >
              {message}
            </p>
          )}
        </form>

        <p className="account-footer">
          Already have an account?{" "}
          <Link href="/login">Log in</Link>
        </p>

        <Link href="/" className="account-home-link">
          Back to home
        </Link>
      </section>
    </main>
  );
}
