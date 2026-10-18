import "server-only";

import { Resend } from "resend";
import { serverEnv } from "@/lib/env/server";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!serverEnv.resendApiKey || !serverEnv.resendFromEmail) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(serverEnv.resendApiKey);
  }
  return resendClient;
}

interface TaskEmailParams {
  to: string;
  subject: string;
  taskTitle: string;
  message: string;
}

export async function sendTaskNotification(
  params: TaskEmailParams
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("Resend not configured; skipping task email notification.");
    return;
  }

  const { error } = await resend.emails.send({
    from: serverEnv.resendFromEmail,
    to: params.to,
    subject: params.subject,
    html: `
      <h2>${params.subject}</h2>
      <p><strong>Task:</strong> ${params.taskTitle}</p>
      <p>${params.message}</p>
    `,
  });

  if (error) {
    console.error("Failed to send task email:", error);
  }
}

interface LeadEmailParams {
  to: string;
  subject: string;
  leadName: string;
  message: string;
}

export async function sendLeadNotification(
  params: LeadEmailParams
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("Resend not configured; skipping lead email notification.");
    return;
  }

  const { error } = await resend.emails.send({
    from: serverEnv.resendFromEmail,
    to: params.to,
    subject: params.subject,
    html: `
      <h2>${params.subject}</h2>
      <p><strong>Lead:</strong> ${params.leadName}</p>
      <p>${params.message}</p>
    `,
  });

  if (error) {
    console.error("Failed to send lead email:", error);
  }
}

// ------------------------------------------------------------------
// Notification fallback: used when a push did not reach the user's device
// ------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface FallbackEmailItem {
  title: string;
  message: string;
  link?: string | null;
}

/**
 * Returns true when the email was actually handed to Resend. Returns false
 * when email isn't configured or sending failed, so callers don't mark the
 * notification as "emailed".
 */
export async function sendNotificationFallbackEmail(params: {
  to: string;
  name?: string | null;
  items: FallbackEmailItem[];
}): Promise<boolean> {
  const resend = getResend();
  if (!resend || params.items.length === 0) return false;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const first = params.items[0];
  const subject =
    params.items.length === 1
      ? `Agency OS: ${first.title}`
      : `Agency OS: ${params.items.length} urgent notifications`;

  const rows = params.items
    .map((item) => {
      const href = item.link && siteUrl ? `${siteUrl}${item.link}` : siteUrl || "";
      const open = href
        ? ` <a href="${escapeHtml(href)}" style="color:#5355EE;font-weight:600">Open</a>`
        : "";
      return `<p style="margin:0 0 14px"><strong>${escapeHtml(item.title)}</strong><br/>${escapeHtml(
        item.message
      ).replace(/\n/g, "<br/>")}${open}</p>`;
    })
    .join("");

  const { error } = await resend.emails.send({
    from: serverEnv.resendFromEmail,
    to: params.to,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>Hi ${escapeHtml(params.name || "there")},</p>
        <p>This did not reach your phone as a push notification, so we are emailing it too:</p>
        ${rows}
        <p style="color:#666;font-size:12px">Turn on notifications in Agency OS to get these instantly.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send notification fallback email:", error);
    return false;
  }
  return true;
}
