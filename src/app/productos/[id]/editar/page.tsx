"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { productSchema, type ProductFormData } from "@/lib/validations/product";
import { getProduct, updateProduct } from "@/lib/actions/products";
import { PRODUCT_TYPE_LABELS, PRODUCT_CATEGORY_LABELS } from "@/lib/constants/categories";
import { Loader2 } from "lucide-react";

export default function EditarProductoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { code: "", name: "", type: "DRESS", category: null, salePrice: null, rentalPrice: null, cost: null, description: "" },
  });

  useEffect(() => {
    getProduct(id).then((p) => {
      if (p) {
        form.reset({
          code: p.code,
          name: p.name,
          type: p.type,
          category: p.category,
          salePrice: p.salePrice ? Number(p.salePrice) : null,
          rentalPrice: p.rentalPrice ? Number(p.rentalPrice) : null,
          cost: p.cost ? Number(p.cost) : null,
          description: p.description ?? "",
        });
      }
      setLoading(false);
    });
  }, [id, form]);

  async function onSubmit(data: ProductFormData) {
    const result = await updateProduct(id, data);
    if (result.success) {
      toast.success("Producto actualizado exitosamente");
      router.push(`/productos/${id}`);
    } else {
      toast.error(result.error);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Producto" backHref={`/productos/${id}`} />
      <Card>
        <CardHeader><CardTitle>Información del producto</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem><FormLabel>Código *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Categoría</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(PRODUCT_CATEGORY_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="salePrice" render={({ field }) => (
                  <FormItem><FormLabel>Precio Venta</FormLabel><FormControl>
                    <Input type="number" placeholder="0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rentalPrice" render={({ field }) => (
                  <FormItem><FormLabel>Precio Alquiler</FormLabel><FormControl>
                    <Input type="number" placeholder="0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cost" render={({ field }) => (
                  <FormItem><FormLabel>Costo</FormLabel><FormControl>
                    <Input type="number" placeholder="0" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => router.push(`/productos/${id}`)}>Cancelar</Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
