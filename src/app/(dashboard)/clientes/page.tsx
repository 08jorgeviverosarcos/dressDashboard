import { getClients } from "@/lib/actions/clients";
import { PageHeader } from "@/components/shared/PageHeader";
import { ClientsTable } from "./clients-table";

interface ClientesPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const { search } = await searchParams;
  const clients = await getClients(search);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        actionLabel="Nuevo Cliente"
        actionHref="/clientes/nuevo"
      />

      <ClientsTable clients={clients} />
    </div>
  );
}
