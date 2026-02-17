import { getCategories } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { CategoriesTable } from "./categories-table";

export default async function CategoriasPage() {
  const categories = await getCategories();

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
