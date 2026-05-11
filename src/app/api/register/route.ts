import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookieValue, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
      slug?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim() || "ScentForge Affiliate";
    const slug = slugify(body.slug || name || email || "affiliate");

    if (!email?.includes("@") || !body.password || body.password.length < 8) {
      return NextResponse.json({ error: "Enter an email and a password with at least 8 characters." }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(body.password),
        affiliate: {
          create: {
            slug,
            commissionRate: 0.1,
          },
        },
      },
      include: { affiliate: true },
    });

    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, affiliate: user.affiliate } });
    response.cookies.set(SESSION_COOKIE, createSessionCookieValue(user.id), sessionCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    const status = message.includes("Unique") || message.includes("unique") ? 409 : 400;
    return NextResponse.json({ error: status === 409 ? "Email or slug already exists." : message }, { status });
  }
}
