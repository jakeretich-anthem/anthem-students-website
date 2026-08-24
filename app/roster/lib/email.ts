// The original app sent email via Cloudflare MailChannels, which only
// authenticates requests originating from a Cloudflare Worker on Cloudflare's
// own network — it will not work from this Next.js host. Swapped for Resend,
// which needs its own API key. Set RESEND_API_KEY (and optionally
// ROSTER_EMAIL_FROM) in your environment; until then this logs and no-ops,
// matching the original's swallow-and-return-false behavior on failure.

// Shared shell for the transactional mail so the four messages the app sends
// look like they came from the same app. Table-based and inline-styled on
// purpose — that is still what mail clients render reliably.
export function emailLayout({
  heading,
  body,
  button,
  footer,
}: {
  heading: string;
  body: string;
  button?: { label: string; url: string; tone?: "primary" | "danger" };
  footer?: string;
}): string {
  const toneColor = button?.tone === "danger" ? "#b91c1c" : "#7a6a3f";
  const buttonHtml = button
    ? `<table cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td style="border-radius:8px;background:${toneColor}">
    <a href="${button.url}" style="display:inline-block;padding:13px 26px;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">${button.label}</a>
  </td></tr></table>`
    : "";
  const footerHtml = footer
    ? `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e8e5dd;color:#8b8578;font-size:12px;line-height:1.5">${footer}</p>`
    : "";

  return `<div style="background:#f4f3ef;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 28px">
    <div style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#7a6a3f;text-transform:uppercase">Anthem Students</div>
    <h1 style="margin:14px 0 16px;font-size:21px;line-height:1.3;color:#111">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#444">${body}</div>
    ${buttonHtml}
    ${footerHtml}
  </div>
</div>`;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ROSTER_EMAIL_FROM || "ASM Roster <onboarding@resend.dev>";
  if (!apiKey) {
    // Print any links the message carried. Without this a local run of the
    // reset or approval flow is untestable — the token only exists in the mail.
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    console.warn(
      `[roster] RESEND_API_KEY not set — email not sent (${subject} -> ${to})` +
        (links.length ? `\n[roster] links in that email:\n  ${links.join("\n  ")}` : "")
    );
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
