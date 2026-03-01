import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { CategoriesTable } from "./categories-table";

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export default async function CategoriasPage({ searchParams }: Props) {
  const params = await searchParams;
  const categories = await getCategories({ search: params.search });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorías"
        description="Gestiona las categorías de productos"
        actionLabel="Nueva Categoría"
        actionHref="/categorias/nuevo"
      />
      <CategoriesTable categories={categories} />
    </div>
  );
}
