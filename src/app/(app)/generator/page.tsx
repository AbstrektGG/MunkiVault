import { requireUser } from "@/lib/auth";
import { PasswordGenerator } from "@/components/PasswordGenerator";
import { PageHead } from "@/components/server";

export const metadata = { title: "Password generator" };

export default async function GeneratorPage() {
  await requireUser();
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <PageHead title="Password generator" />
      <p className="muted">Passwords are generated in your browser and are not sent anywhere. The same generator is available on every credential form.</p>
      <section className="card card-body"><PasswordGenerator /></section>
    </div>
  );
}
