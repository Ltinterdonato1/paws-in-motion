
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Unable to identify your account. Please try again.");
      }

      // Look up the signed-in user's role.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error(
          "We couldn't verify your account role. Please try again or contact support."
        );
      }

      // Send each account to the correct dashboard.
      if (profile.role === "admin") {
        router.replace("/admin");
      } else if (profile.role === "employee") {
        router.replace("/employee");
      } else {
        router.replace("/dashboard");
      }

      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to log in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <section className="account-card">
        
        <Link href="/" className="account-brand">
          Paws in Motion
        </Link>

        <p className="account-eyebrow">WELCOME</p>

        <h1>Log in to your account</h1>

        <p className="account-description">
          Sign in to manage your pets and keep track of your booking requests.
        </p>

        <form onSubmit={handleLogin} className="account-form">
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

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>

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
        </form>

        <p className="account-footer">
          Don't have an account?{" "}
          <Link href="/signup">Create one</Link>
        </p>

        <Link href="/" className="account-home-link">
          Back to home
        </Link>
      </section>
    </main>
  );
}
