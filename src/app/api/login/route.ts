import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookieValue, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const user = await prisma.user.findUnique({
    where: { email: body.email?.trim().toLowerCase() || "" },
    include: { affiliate: true },
  });

  if (!user || !body.password || !verifyPassword(body.password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, affiliate: user.affiliate } });
  response.cookies.set(SESSION_COOKIE, createSessionCookieValue(user.id), sessionCookieOptions());
  return response;
}
