"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="text-button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await fetch("/api/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        });
      }}
    >
      {isPending ? "Leaving" : "Logout"}
    </button>
  );
}
