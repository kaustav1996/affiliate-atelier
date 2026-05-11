"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error || "Something went wrong.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form className="auth-form" action={submit}>
      {mode === "register" ? (
        <>
          <label>
            Name
            <input name="name" placeholder="Maison Creator" required />
          </label>
          <label>
            Affiliate slug
            <input name="slug" placeholder="maison-creator" required />
          </label>
        </>
      ) : null}
      <label>
        Email
        <input
          name="email"
          type="email"
          defaultValue={mode === "login" ? "demo@scentforge.test" : ""}
          placeholder="demo@scentforge.test"
          required
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          defaultValue={mode === "login" ? "password123" : ""}
          placeholder="password123"
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="primary-action" disabled={isPending}>
        {isPending ? "Working" : mode === "login" ? "Log in" : "Create affiliate"}
      </button>
    </form>
  );
}
