// A plain HTML confirmation page for a human clicking an email link — not
// JSON, since there's no client-side app running at this URL.
export function resultPage(title: string, message: string, success: boolean) {
  const color = success ? "#1a7f37" : "#b91c1c";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · ASM Roster</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f3ef; color: #111; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 36px 28px; max-width: 420px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,.08); text-align: center; }
  h1 { font-size: 22px; margin: 0 0 12px; color: ${color}; }
  p { font-size: 15px; line-height: 1.5; color: #444; margin: 0; }
  a { display: inline-block; margin-top: 22px; font-size: 13px; color: #7a6a3f; text-decoration: none; }
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/roster">Go to ASM Roster →</a>
  </div>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
