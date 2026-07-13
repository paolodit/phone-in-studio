import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "ai-phone-in-session";
const payload = "admin";

function secret() {
  return process.env.AUTH_SECRET;
}

function sign(value: string) {
  const signingSecret = secret();
  if (!signingSecret) throw new Error("AUTH_SECRET is required.");
  return createHmac("sha256", signingSecret).update(value).digest("base64url");
}

function verify(token: string | undefined) {
  if (!token || !secret()) return false;
  const [value, signature] = token.split(".");
  if (value !== payload || !signature) return false;
  const expected = sign(value);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}

export async function isAdminSession() {
  return verify((await cookies()).get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdminSession())) redirect("/login");
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function validAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is required.");
  return password.length === expected.length && timingSafeEqual(Buffer.from(password), Buffer.from(expected));
}
