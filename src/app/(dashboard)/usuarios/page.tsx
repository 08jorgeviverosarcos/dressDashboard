import { getUsers } from "@/lib/actions/auth";
import { verifySession } from "@/lib/dal";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { UsersTable } from "./users-table";

export default async function UsuariosPage() {
  const session = await verifySession();
  if (session.role !== "ADMIN") redirect("/");

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios del sistema"
        actionLabel="Nuevo Usuario"
        actionHref="/usuarios/nuevo"
      />
      <UsersTable
        users={users as Array<{ id: string; email: string; name: string; role: "ADMIN" | "SALES"; createdAt: Date }>}
        currentUserId={session.userId}
      />
    </div>
  );
}
