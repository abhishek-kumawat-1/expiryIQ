import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Local POC</p>
          <h1>ExpiryIQ</h1>
          <p className="muted">Track medicine expiry dates from invoice photos, then review before saving.</p>
        </div>
        <AuthForm />
      </section>
    </main>
  );
}
