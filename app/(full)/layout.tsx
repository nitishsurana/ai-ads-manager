import { TopBar } from "@/components/layout/top-bar";

export default function FullLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar tester="Tester" />
      <main className="flex-1 px-8 py-10">{children}</main>
    </div>
  );
}
