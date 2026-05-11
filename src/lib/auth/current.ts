import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSessionCookieValue, SESSION_COOKIE } from "@/lib/auth/session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = readSessionCookieValue(cookieStore.get(SESSION_COOKIE)?.value);

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    include: { affiliate: true },
  });
}

export async function requireAffiliate() {
  const user = await getCurrentUser();

  if (!user?.affiliate) {
    redirect("/login");
  }

  return {
    user,
    affiliate: user.affiliate,
  };
}
