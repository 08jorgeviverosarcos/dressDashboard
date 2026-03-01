import { Sidebar } from "@/components/layout/Sidebar";
import { verifySession } from "@/lib/dal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  return (
    <>
      <Sidebar userRole={session.role} />
      <main className="md:ml-64 min-h-screen">
        <div className="container mx-auto p-6 pt-16 md:pt-6">{children}</div>
      </main>
    </>
  );
}
