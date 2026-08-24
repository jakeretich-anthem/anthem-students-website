import { CSS } from "./appShell/css";
import { HTML_BODY } from "./appShell/body";
import { APP_JS } from "./appShell/clientScript";

// Ported from the original Worker's html/index.js. Returned as a raw HTML
// Response (not a React page) on purpose: the app underneath is a
// self-contained vanilla-JS SPA that does its own DOM manipulation, so it
// stays outside the main site's React tree and global.css/layout entirely.
function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ASM Roster">
<meta name="theme-color" content="#0a0a0f">
<title>ASM 2026 · Worship Grow Go</title>
<link rel="manifest" href="/roster/manifest.json">
<!-- Scoped to /roster on purpose: without these the browser falls back to the
     main site's /favicon.ico, and the roster app gets its own mark. -->
<link rel="icon" type="image/png" sizes="32x32" href="/roster-icon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/roster-icon-192.png">
<link rel="apple-touch-icon" href="/roster-apple-icon.png">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="bg-glow"></div>
${HTML_BODY}
<script>${APP_JS}</script>
</body>
</html>`;
}

export async function GET() {
  return new Response(getHTML(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
