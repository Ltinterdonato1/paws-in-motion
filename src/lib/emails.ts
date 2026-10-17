
import "server-only";

import nodemailer from "nodemailer";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Sends an email using SMTP settings from server environment variables.
 *
 * Required environment variables:
 * SMTP_HOST
 * SMTP_PORT
 * SMTP_USER
 * SMTP_PASSWORD
 * EMAIL_FROM
 *
 * EMAIL_FROM should be an address authorized by your email provider.
 */
export async function sendEmail(
  message: EmailMessage
): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM;

  if (!host || !portValue || !user || !password || !from) {
    return {
      success: false,
      error:
        "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM.",
    };
  }

  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return {
      success: false,
      error: "The SMTP_PORT setting is invalid.",
    };
  }

  if (
    !message.to.trim() ||
    !message.subject.trim() ||
    (!message.text.trim() && !message.html?.trim())
  ) {
    return {
      success: false,
      error: "The email recipient, subject, and message are required.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass: password,
      },
    });

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });

    return { success: true };
  } catch (error) {
    console.error(
      "Email delivery failed:",
      error instanceof Error ? error.message : "Unknown email error"
    );

    return {
      success: false,
      error: "The email could not be sent. Check the server email configuration.",
    };
  }
}
