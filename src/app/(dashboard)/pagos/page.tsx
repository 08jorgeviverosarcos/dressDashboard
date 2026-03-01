import { getPayments } from "@/lib/actions/payments";
import { PageHeader } from "@/components/shared/PageHeader";
import { PaymentsTable } from "./payments-table";

interface Props {
  searchParams: Promise<{ search?: string; method?: string; startDate?: string; endDate?: string }>;
}

export default async function PagosPage({ searchParams }: Props) {
  const params = await searchParams;
  const payments = await getPayments({
    search: params.search,
    paymentMethod: params.method,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pagos" description="Historial de pagos de todos los pedidos" />
      <PaymentsTable
        payments={JSON.parse(JSON.stringify(payments))}
        currentMethod={params.method}
      />
    </div>
  );
}
