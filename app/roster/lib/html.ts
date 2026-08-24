// Several routes build HTML by hand — the email bodies and the confirmation
// pages a human clicks from those emails — and interpolate names and addresses
// that came from a signup form. Run every such value through this first.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
