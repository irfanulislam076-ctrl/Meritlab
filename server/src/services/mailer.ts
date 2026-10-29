import nodemailer from "nodemailer";
import { env, isProd, smtpEnabled } from "../config/env";
import { ApiError } from "../utils/ApiError";

const transporter = smtpEnabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null;

function fromAddress(): string {
  const from = (env.SMTP_FROM ?? env.SMTP_USER ?? "").trim();
  return from.includes("<") ? from : `"Meritlab" <${from}>`;
}

const PURPOSE_TEXT = {
  REGISTER: "verify your email",
  RESET: "reset your password",
  ADMIN_LOGIN: "sign in",
} as const;

export async function sendOtpEmail(
  to: string,
  name: string,
  code: string,
  purpose: keyof typeof PURPOSE_TEXT,
): Promise<void> {
  // No SMTP configured: print the code so development still works.
  if (!transporter) {
    console.log(`[mail disabled] OTP for ${to} (${purpose}): ${code}`);
    return;
  }

  const action = PURPOSE_TEXT[purpose];
  try {
    await transporter.sendMail({
      from: fromAddress(),
      to,
      subject: `Your Meritlab code: ${code}`,
      text: `Hi ${name},\n\nYour code to ${action} is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:420px">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Your code to ${action}:</p>
        <p style="font-size:30px;letter-spacing:6px;font-weight:bold;margin:16px 0">${code}</p>
        <p style="color:#666">It expires in 10 minutes. If you did not request this, ignore this email.</p>
      </div>`,
    });
  } catch (error) {
    console.error(`\n[EMAIL FAILED] ${mailHint(error)}\n`);
    if (!isProd) {
      console.log(`[dev fallback] OTP for ${to} (${purpose}): ${code}`);
      return;
    }
    throw new ApiError(502, "Could not send the email right now. Please try again.");
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plain notice email. Failures are logged and never thrown (used for bulk sends). */
export async function sendNoticeEmail(to: string, subject: string, text: string): Promise<void> {
  if (!transporter) return;
  await transporter.sendMail({ from: fromAddress(), to, subject, text }).catch((e) => console.error("Notice email failed:", e instanceof Error ? e.message : e));
}

/** Turns an SMTP error into the most likely fix. */
export function mailHint(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  let hint = "Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in server/.env.";
  if (/Unauthorized IP|525/i.test(msg)) hint = "Brevo blocks this computer's IP address. In Brevo open SMTP & API, click the blue banner link (Authorised IPs) and either add your current IP or deactivate IP blocking. On Render you must deactivate blocking, because Render IPs change.";
  else if (/535|Invalid login|authentication/i.test(msg)) hint = "Brevo refused the login. SMTP_USER must be the SMTP login shown in Brevo under SMTP & API (it looks like 9xxxxx001@smtp-brevo.com) and SMTP_PASS must be an SMTP key (xsmtpsib-...), not your account password.";
  else if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|ENOTFOUND|Greeting never received/i.test(msg)) hint = "Cannot reach the mail server. Your network may block port 587: set SMTP_PORT=2525 in server/.env and try again.";
  else if (/sender|from address|not valid/i.test(msg)) hint = "Brevo does not accept this sender. Add and verify SMTP_FROM under Brevo, Senders and domains.";
  return `${msg}\n  Fix: ${hint}`;
}

/** Runs at startup so a broken mail setup is visible at once, not at the first sign up. */
export async function verifyMail(): Promise<void> {
  if (!transporter) return console.warn("Mail: SMTP is not configured, OTP codes are printed in this terminal.");
  try {
    await transporter.verify();
    console.log(`Mail: SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT})`);
  } catch (error) {
    console.error(`\n[MAIL NOT WORKING] ${mailHint(error)}\n`);
  }
}

/** Used by `npm run mail:test`. Throws the raw error. */
export async function sendTestEmail(to: string): Promise<void> {
  if (!transporter) throw new Error("SMTP is not configured");
  await transporter.sendMail({ from: fromAddress(), to, subject: "Meritlab test email", text: "If you can read this, email sending works." });
}

const signOff = "\n\nMeritlab";
export const sendPaymentReceivedEmail = (to: string, name: string, course: string) =>
  sendNoticeEmail(to, "Thank you for your purchase", `Hi ${name},\n\nThank you for purchasing our course "${course}". One of our admins will verify and approve you as soon as possible and will let you know via email once it is confirmed.${signOff}`);
export const sendPaymentApprovedEmail = (to: string, name: string, course: string, expiresAt: Date) =>
  sendNoticeEmail(to, "Your payment is approved", `Hi ${name},\n\nYour payment for "${course}" has been approved. You can start your exams now. Your access is active until ${expiresAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "long" })}.${signOff}`);
export const sendPaymentRejectedEmail = (to: string, name: string, course: string, reason: string) =>
  sendNoticeEmail(to, "About your payment", `Hi ${name},\n\nWe could not approve your payment for "${course}". Reason: ${reason}. You can submit the payment again from the course page.${signOff}`);
