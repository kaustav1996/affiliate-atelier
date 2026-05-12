import type { Affiliate, User } from "@/generated/prisma/client";

type ViewerUser = User & { affiliate: Affiliate | null };

export function toStorefrontViewer(user: ViewerUser | null) {
  if (!user?.affiliate) {
    return null;
  }

  return {
    name: user.name,
    dashboardHref: "/dashboard",
  };
}
