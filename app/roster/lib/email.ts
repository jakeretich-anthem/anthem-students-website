// The original app sent email via Cloudflare MailChannels, which only
// authenticates requests originating from a Cloudflare Worker on Cloudflare's
// own network — it will not work from this Next.js host. Swapped for Resend,
// which needs its own API key. Set RESEND_API_KEY (and optionally
// ROSTER_EMAIL_FROM) in your environment; until then this logs and no-ops,
// matching the original's swallow-and-return-false behavior on failure.

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
    console.warn(`[roster] RESEND_API_KEY not set — email not sent (${subject} -> ${to})`);
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
