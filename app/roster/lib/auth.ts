import { cookies } from "next/headers";
import { kvDelete, kvGet, kvList } from "./kv";

export const SESSION_COOKIE_NAME = "asm_session";
export const SESSION_TTL = 30 * 24 * 60 * 60; // 30 days, matches original

export type RosterUser = {
  name: string;
  email: string | null;
  role: string;
  passwordHash?: string;
  status?: string | null;
  photoUrl?: string | null;
  photoCrop?: { zoom: number; offX: number; offY: number } | null;
  leaderSince?: string | null;
  funFact?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
  expiresAt?: number | null;
};

type Session = { type?: string; email?: string; expiresAt: number };

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setSessionCookie(token: string, maxAge: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, cookieOptions(maxAge));
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, "", cookieOptions(0));
}

export async function getToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getSessionUser(): Promise<RosterUser | null> {
  const token = await getToken();
  if (!token) return null;
  const sess = await kvGet<Session>(`session:${token}`);
  if (!sess || Date.now() > sess.expiresAt) {
    if (sess) await kvDelete(`session:${token}`);
    return null;
  }
  // Passcode session — synthetic read-only user (no email, no editing)
  if (sess.type === "passcode") {
    return { name: "Viewer", email: null, role: "viewer", expiresAt: sess.expiresAt };
  }
  return kvGet<RosterUser>(`user:${sess.email}`);
}

export const PERMISSION_LEVELS: Record<string, number> = { none: 0, view: 1, edit: 2, admin: 3 };
export const ROLE_DEFAULTS: Record<string, string> = {
  pending: "view",
  approved: "edit",
  leader: "edit",
  admin: "admin",
  viewer: "view",
};

const DEFAULT_MODULES: Record<string, Record<string, string>> = {
  roster: { pending: "view", approved: "edit", leader: "edit", admin: "admin" },
  activity: { pending: "view", approved: "view", leader: "edit", admin: "admin" },
  brainDump: { pending: "none", approved: "edit", leader: "edit", admin: "admin" },
  attendance: { pending: "view", approved: "edit", leader: "edit", admin: "admin" },
  hangoutNotes: { pending: "none", approved: "edit", leader: "edit", admin: "admin" },
  adminland: { pending: "none", approved: "none", leader: "none", admin: "admin" },
  dashboard: { pending: "view", approved: "view", leader: "view", admin: "admin" },
};

export async function getPermissionMatrix(): Promise<Record<string, Record<string, string>>> {
  const settings = await kvGet<{ permissions?: { modules?: Record<string, Record<string, string>> } }>(
    "settings:org"
  );
  const matrix = settings?.permissions?.modules || {};
  const merged: Record<string, Record<string, string>> = {};
  for (const [module, defaults] of Object.entries(DEFAULT_MODULES)) {
    merged[module] = { ...defaults, ...(matrix[module] || {}) };
  }
  return merged;
}

export async function hasPermission(user: RosterUser | null, module: string, level = "view"): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;
  const matrix = await getPermissionMatrix();
  const role = user.role || "pending";
  const userLevel = matrix[module]?.[role] || ROLE_DEFAULTS[role] || "none";
  return (PERMISSION_LEVELS[userLevel] || 0) >= (PERMISSION_LEVELS[level] || 0);
}

export async function requirePermission(
  module: string,
  level = "view"
): Promise<{ ok: true; user: RosterUser } | { ok: false; status: number; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: "Not authenticated" };
  const ok = await hasPermission(user, module, level);
  if (!ok) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, user };
}

export async function requireAdmin(): Promise<{ ok: true; user: RosterUser } | { ok: false; status: number; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 403, error: "Unauthorized" };
  const ok = await hasPermission(user, "adminland", "admin");
  if (!ok) return { ok: false, status: 403, error: "Unauthorized" };
  return { ok: true, user };
}

export async function listAdmins(): Promise<{ email: string }[]> {
  const list = await kvList("user:");
  const admins: { email: string }[] = [];
  for (const key of list.keys) {
    const u = await kvGet<RosterUser>(key.name);
    if (u?.role === "admin" && u.email) admins.push({ email: u.email });
  }
  if (!admins.length && process.env.ADMIN_EMAIL) admins.push({ email: process.env.ADMIN_EMAIL });
  return admins;
}

export function safeUser(user: RosterUser) {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    photoUrl: user.photoUrl || null,
    photoCrop: user.photoCrop || null,
    leaderSince: user.leaderSince || null,
    funFact: user.funFact || null,
    expiresAt: user.expiresAt || null,
    status: user.status || null,
    mustChangePassword: !!user.mustChangePassword,
  };
}
