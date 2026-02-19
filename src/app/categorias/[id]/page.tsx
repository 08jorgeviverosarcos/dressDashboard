import { notFound } from "next/navigation";
import Link from "next/link";
import { getCategory } from "@/lib/actions/categories";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants/categories";
import { Pencil } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoriaDetailPage({ params }: Props) {
  const { id } = await params;
  const category = await getCategory(id);

  if (!category) return notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={category.name}
        backHref="/categorias"
      />

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href={`/categorias/${id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Código</span>
            <span className="font-medium">{category.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Nombre</span>
            <span>{category.name}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos ({category.products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {category.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin productos en esta categoría</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Código</th>
                    <th className="p-3 text-left font-medium">Nombre</th>
                    <th className="p-3 text-left font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {category.products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <Link href={`/productos/${product.id}`} className="text-primary hover:underline font-medium">
                          {product.code}
                        </Link>
                      </td>
                      <td className="p-3">{product.name}</td>
                      <td className="p-3">{PRODUCT_TYPE_LABELS[product.type] ?? product.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
