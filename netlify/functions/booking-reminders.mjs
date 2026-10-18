import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const config = { schedule: "*/5 * * * *" };

const timezone = "America/Los_Angeles";

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizePhone(value) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function sendText(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Twilio SMS settings are missing.");

  const payload = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });
  if (!response.ok) throw new Error(`Twilio returned ${response.status}: ${await response.text()}`);
}

function emailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass || !process.env.EMAIL_FROM) {
    throw new Error("SMTP email settings are missing.");
  }
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

async function sendEmail(to, subject, body) {
  const transport = emailTransport();
  await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text: body });
}

export default async function handler() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server settings are missing.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const now = Date.now();
  const windows = [
    { label: "24h", hours: 24, emailField: "reminder_24h_email_sent_at", smsField: "reminder_24h_sms_sent_at" },
    { label: "2h", hours: 2, emailField: "reminder_2h_email_sent_at", smsField: "reminder_2h_sms_sent_at" },
  ];
  const { data: services, error } = await supabase
    .from("booking_services")
    .select("id, booking_id, service_name, service_option, service_start, pet_name, reminder_24h_email_sent_at, reminder_24h_sms_sent_at, reminder_2h_email_sent_at, reminder_2h_sms_sent_at, bookings!inner(id, status, customer_id, guest_name, guest_email, guest_phone, notification_preference, sms_consent)")
    .eq("bookings.status", "approved");
  if (error) throw error;

  let transporter;
  for (const item of services ?? []) {
    const start = new Date(item.service_start).getTime();
    const hoursToStart = (start - now) / 3600000;
    const window = windows.find(({ hours }) => hoursToStart <= hours && hoursToStart > hours - 5 / 60);
    if (!window) continue;

    const booking = Array.isArray(item.bookings) ? item.bookings[0] : item.bookings;
    if (!booking) continue;
    let profile = null;
    if (booking.customer_id) {
      const { data, error: profileError } = await supabase
        .from("profiles").select("email, full_name, phone").eq("id", booking.customer_id).maybeSingle();
      if (profileError) console.error("Reminder profile lookup failed", profileError.message);
      profile = data;
    }
    const name = profile?.full_name?.trim() || booking.guest_name?.trim() || "there";
    const email = profile?.email?.trim() || booking.guest_email?.trim();
    const phone = normalizePhone(profile?.phone || booking.guest_phone);
    const appointment = `${item.service_name} (${item.service_option}) for ${item.pet_name || "your pet"} is scheduled for ${dateLabel(item.service_start)}.`;
    const message = window.hours === 24
      ? `Hi ${name}, a reminder from Paws in Motion: ${appointment} Reply to this email or call us if you need help.`
      : `Hi ${name}, ${appointment} If you need to cancel, please do so at least 1 hour before the appointment to avoid the $20 late-cancellation fee. — Paws in Motion`;

    if (["email", "both"].includes(booking.notification_preference) && email && !item[window.emailField]) {
      try {
        transporter ??= emailTransport();
        await transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: `Paws in Motion ${window.label} appointment reminder`,
          text: message,
        });
        const { error: updateError } = await supabase.from("booking_services")
          .update({ [window.emailField]: new Date().toISOString() }).eq("id", item.id);
        if (updateError) throw updateError;
      } catch (sendError) {
        console.error(`Email reminder failed for ${item.id}:`, sendError.message);
      }
    }

    if (["text", "both"].includes(booking.notification_preference) && booking.sms_consent && phone && !item[window.smsField]) {
      try {
        await sendText(phone, message);
        const { error: updateError } = await supabase.from("booking_services")
          .update({ [window.smsField]: new Date().toISOString() }).eq("id", item.id);
        if (updateError) throw updateError;
      } catch (sendError) {
        console.error(`SMS reminder failed for ${item.id}:`, sendError.message);
      }
    }
  }

  return new Response("Reminder run complete.", { status: 200 });
}
