import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Affiliate access</p>
        <h1>Enter the Atelier.</h1>
        <p>Demo credentials are prefilled: demo@scentforge.test / password123.</p>
        <AuthForm mode="login" />
        <Link href="/register">Create a new affiliate account</Link>
      </section>
    </main>
  );
}
