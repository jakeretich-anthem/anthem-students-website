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

export const PASSWORD_MIN_LENGTH = 10;

// The rules, in the order they're shown to the person typing. The UI renders
// this list as a live checklist so the requirements aren't a surprise on submit.
export const PASSWORD_RULES = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (p: string) => p.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "digit", label: "A number", test: (p: string) => /\d/.test(p) },
];

// Names the first unmet rule rather than returning a bare "Weak password", so
// someone who is one character short is told that instead of guessing.
export function describePasswordProblem(password = ""): string | null {
  const failed = PASSWORD_RULES.filter((r) => !r.test(password));
  if (!failed.length) return null;
  if (failed.length === PASSWORD_RULES.length) {
    return `Password needs ${PASSWORD_MIN_LENGTH}+ characters with an uppercase letter, a lowercase letter and a number.`;
  }
  const missing = failed.map((r) => r.label.toLowerCase());
  const list = missing.length === 1 ? missing[0] : missing.slice(0, -1).join(", ") + " and " + missing[missing.length - 1];
  return `Password still needs ${list}.`;
}

export function validatePasswordStrength(password = ""): boolean {
  return describePasswordProblem(password) === null;
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
