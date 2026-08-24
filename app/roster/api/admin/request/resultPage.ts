import { escapeHtml } from "../../../lib/html";

const SHELL_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f3ef; color: #111; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 36px 28px; max-width: 460px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,.08); text-align: center; }
  .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .12em; color: #7a6a3f; text-transform: uppercase; }
  h1 { font-size: 22px; margin: 12px 0; }
  p { font-size: 15px; line-height: 1.5; color: #444; margin: 0; }
  .home { display: inline-block; margin-top: 22px; font-size: 13px; color: #7a6a3f; text-decoration: none; }
`;

function shell(title: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)} · ASM Roster</title>
<style>${SHELL_STYLES}</style>
</head>
<body>
  <div class="card">${inner}</div>
</body>
</html>`;
}

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

// A plain HTML confirmation page for a human clicking an email link — not
// JSON, since there's no client-side app running at this URL.
export function resultPage(title: string, message: string, success: boolean) {
  const color = success ? "#1a7f37" : "#b91c1c";
  return new Response(
    shell(
      title,
      `<h1 style="color:${color}">${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a class="home" href="/roster">Go to ASM Roster →</a>`
    ),
    { headers: HTML_HEADERS }
  );
}

// The page the emailed link actually opens. It only reads — the approve and
// decline routes are POST, so a mail scanner or link preview that follows the
// URL can't act on the request. The admin's click on one of these buttons is
// what decides it.
export function reviewPage(opts: {
  token: string;
  name: string;
  email: string;
  requestedAt: string;
}) {
  const { token, name, email, requestedAt } = opts;
  const inner = `
    <div class="eyebrow">Anthem Students</div>
    <h1>Leader access request</h1>
    <div style="text-align:left;background:#faf9f6;border:1px solid #e8e5dd;border-radius:12px;padding:16px 18px;margin:20px 0">
      <div style="margin-bottom:8px"><b>Name:</b> ${escapeHtml(name)}</div>
      <div style="margin-bottom:8px"><b>Email:</b> ${escapeHtml(email)}</div>
      <div><b>Requested:</b> ${escapeHtml(requestedAt)}</div>
    </div>
    <p style="font-size:14px">Approving gives them leader access and emails them that they can sign in. Declining deletes the request; they are told nothing.</p>
    <div style="display:flex;gap:12px;margin-top:24px">
      <form method="POST" action="/roster/api/admin/request/approve" style="flex:1">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <button type="submit" style="width:100%;padding:13px;background:#1a7f37;color:#fff;border:0;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">Approve</button>
      </form>
      <form method="POST" action="/roster/api/admin/request/decline" style="flex:1" onsubmit="return confirm('Decline and delete this request? They will not be notified.')">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <button type="submit" style="width:100%;padding:13px;background:#fff;color:#b91c1c;border:1px solid #e0c9c9;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">Decline</button>
      </form>
    </div>
    <a class="home" href="/roster">Go to ASM Roster →</a>`;
  return new Response(shell("Leader access request", inner), { headers: HTML_HEADERS });
}

// Both POST handlers accept the token from a form post (the review page) or a
// JSON body, so the flow works from the page and from a scripted call.
export async function readToken(request: Request): Promise<string | null> {
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) {
      const body = await request.json();
      return body?.token || null;
    }
    const form = await request.formData();
    const value = form.get("token");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}
