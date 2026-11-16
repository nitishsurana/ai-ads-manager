import { TopBar } from "@/components/layout/top-bar";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar tester="Admin" admin />
      <main className="flex-1 px-8 pt-6 pb-12">{children}</main>
    </div>
  );
}
