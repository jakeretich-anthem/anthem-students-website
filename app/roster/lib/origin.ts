// Links that go out in email have to point at the public URL, not whatever
// origin the request arrived on. Behind a proxy (Vercel, a load balancer)
// `new URL(request.url).origin` is the internal address, which produces reset
// and approval links that resolve for nobody.
export function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const host = request.headers.get("x-forwarded-host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
