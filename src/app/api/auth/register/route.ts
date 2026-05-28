import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name || !email || password.length < 6) {
    return NextResponse.json({ error: "Name, email, and a 6+ character password are required." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password)
    }
  });

  await setSessionCookie(user.id);
  return NextResponse.json({
    ok: true,
    token: createSessionToken(user.id),
    user: { id: user.id, name: user.name, email: user.email }
  });
}
