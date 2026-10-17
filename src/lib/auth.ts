
import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export type UserRole = "customer" | "employee" | "admin";

export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
};

/**
 * Gets the currently signed-in user and their profile.
 * Returns null if the user is not signed in or has no profile.
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  if (
    profile.role !== "customer" &&
    profile.role !== "employee" &&
    profile.role !== "admin"
  ) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    phone: profile.phone,
    role: profile.role,
  };
}

/**
 * Requires a signed-in user.
 * Redirects to /login when the user is not authenticated.
 */
export async function requireUser(): Promise<UserProfile> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Requires the signed-in user to have the admin role.
 * Sends other users to their appropriate dashboard.
 */
export async function requireAdmin(): Promise<UserProfile> {
  const user = await requireUser();

  if (user.role !== "admin") {
    if (user.role === "employee") {
      redirect("/employee");
    }

    redirect("/dashboard");
  }

  return user;
}

/**
 * Requires the signed-in user to have the employee role.
 * Sends other users to their appropriate dashboard.
 */
export async function requireEmployee(): Promise<UserProfile> {
  const user = await requireUser();

  if (user.role !== "employee") {
    if (user.role === "admin") {
      redirect("/admin");
    }

    redirect("/dashboard");
  }

  return user;
}
