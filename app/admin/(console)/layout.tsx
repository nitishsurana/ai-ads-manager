import { TopBar } from "@/components/layout/top-bar";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar tester="Admin" admin />
      <main className="flex-1 px-8 pt-6 pb-12">{children}</main>
    </div>
  );
}
