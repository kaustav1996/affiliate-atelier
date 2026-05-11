import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Affiliate registration</p>
        <h1>Open a commission atelier.</h1>
        <p>Choose a slug; it becomes your public referral path and storefront address.</p>
        <AuthForm mode="register" />
        <Link href="/login">Already have an account?</Link>
      </section>
    </main>
  );
}
