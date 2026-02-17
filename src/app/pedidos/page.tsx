import { getOrders } from "@/lib/actions/orders";
import { PageHeader } from "@/components/shared/PageHeader";
import { OrdersTable } from "./orders-table";
import type { OrderStatus } from "@prisma/client";

interface Props {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function PedidosPage({ searchParams }: Props) {
  const params = await searchParams;
  const orders = await getOrders({
    search: params.search,
    status: params.status as OrderStatus | undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Gestiona pedidos de clientes"
        actionLabel="Nuevo Pedido"
        actionHref="/pedidos/nuevo"
      />
      <OrdersTable
        orders={JSON.parse(JSON.stringify(orders))}
        currentStatus={params.status}
      />
    </div>
  );
}
