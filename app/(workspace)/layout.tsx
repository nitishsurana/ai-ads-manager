import { TopBar } from "@/components/layout/top-bar";
import { requireTester } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const { name } = await requireTester();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar tester={name} />
      {children}
    </div>
  );
}
