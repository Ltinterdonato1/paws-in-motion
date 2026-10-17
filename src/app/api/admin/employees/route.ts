import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

async function verifyAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return { error: "You must be signed in.", status: 401 as const };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return {
      error: "Supabase environment variables are missing.",
      status: 500 as const,
    };
  }

  const userClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await userClient.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: "Your session is invalid or expired.",
      status: 401 as const,
    };
  }

  const adminClient = createSupabaseAdmin();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      error: "Only administrators can manage team accounts.",
      status: 403 as const,
    };
  }

  return { adminClient, currentUserId: data.user.id };
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);

  if ("error" in auth) {
    return errorResponse(
      auth.error ?? "You are not authorized to perform this action.",
      auth.status
    );
  }

  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const temporaryPassword = String(body.temporaryPassword ?? "");
    const role = body.role === "admin" ? "admin" : "employee";

    if (!fullName || !email || !phone || !temporaryPassword) {
      return errorResponse(
        "Name, email, phone number, and temporary password are required."
      );
    }

    if (
      fullName.length > 120 ||
      email.length > 254 ||
      phone.length > 40
    ) {
      return errorResponse("One or more fields are too long.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse("Please enter a valid email address.");
    }

    if (
      temporaryPassword.length < 8 ||
      temporaryPassword.length > 128
    ) {
      return errorResponse(
        "The temporary password must be between 8 and 128 characters."
      );
    }

    const { data: created, error: createError } =
      await auth.adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createError) {
      return errorResponse(createError.message);
    }

    if (!created.user) {
      return errorResponse("Unable to create the account.", 500);
    }

    const newUserId = created.user.id;

    const { error: metadataError } =
      await auth.adminClient.auth.admin.updateUserById(newUserId, {
        app_metadata: {
          ...created.user.app_metadata,
          must_change_password: true,
        },
      });

    if (metadataError) {
      await auth.adminClient.auth.admin.deleteUser(newUserId);
      return errorResponse(
        `Unable to prepare the new account: ${metadataError.message}`,
        500
      );
    }

    const { error: profileError } = await auth.adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        email,
        full_name: fullName,
        phone,
        role,
      });

    if (profileError) {
      await auth.adminClient.auth.admin.deleteUser(newUserId);
      return errorResponse(
        `Unable to save the team profile: ${profileError.message}`,
        500
      );
    }

    return NextResponse.json({
      message:
        role === "admin"
          ? "Administrator account created successfully."
          : "Employee account created successfully.",
      userId: newUserId,
      mustChangePassword: true,
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to create the account.",
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);

  if ("error" in auth) {
    return errorResponse(
      auth.error ?? "You are not authorized to perform this action.",
      auth.status
    );
  }

  try {
    const body = await request.json();
    const employeeId = String(body.employeeId ?? "").trim();

    if (!employeeId) {
      return errorResponse("A team member ID is required.");
    }

    if (body.action === "promote") {
      const { data, error } = await auth.adminClient
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", employeeId)
        .eq("role", "employee")
        .select("id")
        .maybeSingle();

      if (error) return errorResponse(error.message, 500);

      if (!data) {
        return errorResponse(
          "Employee not found or already promoted.",
          404
        );
      }

      return NextResponse.json({
        message: "Employee promoted to administrator successfully.",
      });
    }

    if (body.action === "edit-profile") {
      const fullName = String(body.fullName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const phone = String(body.phone ?? "").trim();

      if (!fullName || !email) {
        return errorResponse("Name and email are required.");
      }

      if (
        fullName.length > 120 ||
        email.length > 254 ||
        phone.length > 40
      ) {
        return errorResponse("One or more fields are too long.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return errorResponse("Please enter a valid email address.");
      }

      const { data: existingProfile, error: existingError } =
        await auth.adminClient
          .from("profiles")
          .select("id, role")
          .eq("id", employeeId)
          .maybeSingle();

      if (existingError) {
        return errorResponse(existingError.message, 500);
      }

      if (
        !existingProfile ||
        !["employee", "admin"].includes(existingProfile.role)
      ) {
        return errorResponse("Team member not found.", 404);
      }

      const { error: authUpdateError } =
        await auth.adminClient.auth.admin.updateUserById(employeeId, {
          email,
          user_metadata: { full_name: fullName },
        });

      if (authUpdateError) {
        return errorResponse(
          `Unable to update the login account: ${authUpdateError.message}`
        );
      }

      const { error: profileUpdateError } = await auth.adminClient
        .from("profiles")
        .update({ full_name: fullName, email, phone })
        .eq("id", employeeId);

      if (profileUpdateError) {
        return errorResponse(
          `The login account was updated, but the profile update failed: ${profileUpdateError.message}`,
          500
        );
      }

      return NextResponse.json({
        message: "Name, email, and phone number updated successfully.",
      });
    }

    const phone = String(body.phone ?? "").trim();

    if (phone.length > 40) {
      return errorResponse("Phone number is too long.");
    }

    const { data, error } = await auth.adminClient
      .from("profiles")
      .update({ phone })
      .eq("id", employeeId)
      .eq("role", "employee")
      .select("id")
      .maybeSingle();

    if (error) return errorResponse(error.message, 500);

    if (!data) {
      return errorResponse("Employee not found.", 404);
    }

    return NextResponse.json({
      message: "Employee phone number updated.",
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to update the account.",
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin(request);

  if ("error" in auth) {
    return errorResponse(
      auth.error ?? "You are not authorized to perform this action.",
      auth.status
    );
  }

  try {
    const body = await request.json();
    const employeeId = String(body.employeeId ?? "").trim();

    if (!employeeId) {
      return errorResponse("A team member ID is required.");
    }

    if (employeeId === auth.currentUserId) {
      return errorResponse(
        "You cannot delete your own administrator account.",
        403
      );
    }

    const { data: employee, error: employeeError } =
      await auth.adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", employeeId)
        .maybeSingle();

    if (employeeError) {
      return errorResponse(employeeError.message, 500);
    }

    if (!employee || !["employee", "admin"].includes(employee.role)) {
      return errorResponse("Team member not found.", 404);
    }

    if (employee.role === "admin") {
      const { count, error: countError } = await auth.adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        return errorResponse(
          "Unable to verify the number of administrators.",
          500
        );
      }

      if (count === null || count <= 1) {
        return errorResponse(
          "You cannot delete the last administrator. Add another administrator first.",
          409
        );
      }
    }

    if (employee.role === "employee") {
      const { error: bookingError } = await auth.adminClient
        .from("bookings")
        .update({ assigned_employee_id: null })
        .eq("assigned_employee_id", employeeId);

      if (bookingError) {
        return errorResponse(
          `Unable to unassign the employee's bookings: ${bookingError.message}`,
          500
        );
      }
    }

    const { error: deleteError } =
      await auth.adminClient.auth.admin.deleteUser(employeeId);

    if (deleteError) {
      return errorResponse(deleteError.message, 500);
    }

    return NextResponse.json({
      message:
        employee.role === "admin"
          ? "Administrator account deleted successfully."
          : "Employee account deleted successfully.",
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to delete the team member.",
      500
    );
  }
}