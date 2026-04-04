import "server-only";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "matkrig_admin";

/**
 * Check if the request has a valid admin session (cookie-based).
 * The admin logs in by providing the ADMIN_SECRET, which sets a session cookie.
 */
export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE);
  return adminCookie?.value === secret;
}

/**
 * Verify admin secret from a request header or form field.
 */
export function verifyAdminSecret(providedSecret: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return providedSecret === secret;
}
