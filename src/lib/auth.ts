import { createHmac, timingSafeEqual, pbkdf2Sync, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "expiryiq_session";
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  userId: string;
  exp: number;
};

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const attempted = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempted, "hex"));
}

export async function setSessionCookie(userId: string) {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + ONE_WEEK_SECONDS
  };

  cookieStore.set(COOKIE_NAME, signPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_SECONDS,
    path: "/"
  });
}

export function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + ONE_WEEK_SECONDS
  };

  return signPayload(payload);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getUserFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return getCurrentUser();
  }

  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, email: true }
  });
}

export async function requireApiUser(request?: NextRequest) {
  const user = request ? await getUserFromRequest(request) : await getCurrentUser();
  if (!user) {
    return null;
  }

  return user;
}

function signPayload(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "expiryiq-local-dev-secret";
}
