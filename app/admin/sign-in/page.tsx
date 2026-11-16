import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSignInForm } from "@/components/auth/admin-sign-in-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { isAdmin } from "@/lib/auth";

export default async function Page() {
  if (await isAdmin()) redirect("/admin");

  return (
    <AuthShell
      footer={
        <>
          Tester?{" "}
          <Link href="/sign-in" className="text-primary-text hover:underline">
            Use tester sign-in
          </Link>
        </>
      }
    >
      <AdminSignInForm />
    </AuthShell>
  );
}
