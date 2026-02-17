import { getClients } from "@/lib/actions/clients";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchInput } from "@/components/shared/SearchInput";
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

      <SearchInput placeholder="Buscar por nombre, tel\u00e9fono o email..." />

      <ClientsTable clients={clients} />
    </div>
  );
}
