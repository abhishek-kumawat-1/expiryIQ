import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import Image from "next/image";
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Full Proof Solution for your inventory</p>
          <Image src="/logo.png" alt="ExpiryIQ Logo" width={260} height={80} priority className="landing-logo" />
          <p className="muted">Track medicine expiry dates from invoice photos.</p>
          <p className="muted">Start Tracking...</p>
        </div>
        <AuthForm />
      </section>
    </main>
  );
}
