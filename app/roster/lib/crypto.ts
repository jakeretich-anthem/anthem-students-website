// Ported unchanged from the original Worker — all Web Crypto (crypto.subtle,
// crypto.getRandomValues), which is a global standard available in both the
// Node.js runtime here and the original Workers runtime.

export function hashToken(token: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km,
    256
  );
  const h = (b: number) => b.toString(16).padStart(2, "0");
  return [...salt].map(h).join("") + ":" + [...new Uint8Array(bits)].map(h).join("");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("") === hashHex;
}

export function generateToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Password complexity rules were removed — any non-empty password is accepted.
export function describePasswordProblem(password = ""): string | null {
  return password ? null : "Enter a password.";
}

// Constant-time-ish string comparison (matches the original's approach).
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a.padEnd(128));
  const bufB = enc.encode(b.padEnd(128));
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0 && a.length === b.length;
}
