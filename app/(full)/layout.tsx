import { TopBar } from "@/components/layout/top-bar";
import { requireTester } from "@/lib/auth";

export default async function FullLayout({ children }: LayoutProps<"/">) {
  const { name } = await requireTester();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar tester={name} />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
