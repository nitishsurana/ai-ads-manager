import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { TesterSignInForm } from "@/components/auth/tester-sign-in-form";
import { getTester, safeNextPath } from "@/lib/auth";

export default async function Page({ searchParams }: PageProps<"/sign-in">) {
  if (await getTester()) redirect("/");
  const { next } = await searchParams;

  return (
    <AuthShell
      footer={
        <>
          Admin?{" "}
          <Link
            href="/admin/sign-in"
            className="text-primary-text hover:underline"
          >
            Use admin sign-in
          </Link>
        </>
      }
    >
      <TesterSignInForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
