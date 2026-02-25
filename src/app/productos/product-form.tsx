"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { productSchema, type ProductFormData } from "@/lib/validations/product";
import { createProduct, getSuggestedProductCode, updateProduct } from "@/lib/actions/products";
import { PRODUCT_TYPE_LABELS } from "@/lib/constants/categories";
import { Loader2 } from "lucide-react";
import { EntitySelectorTrigger } from "@/components/shared/EntitySelectorTrigger";
import { EntitySelectorModal, type EntitySelectorColumn } from "@/components/shared/EntitySelectorModal";
import { CategoryQuickForm } from "@/features/products/components/CategoryQuickForm";

interface Category {
  id: string;
  name: string;
  code: string;
}

interface ProductFormProps {
  categories: Category[];
  productId?: string;
  initialData?: ProductFormData;
}

export function ProductForm({ categories, productId, initialData }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!productId;
  const hasManualCodeEdit = useRef(false);
  const isApplyingSuggestion = useRef(false);
  const suggestionRequestId = useRef(0);

  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: initialData ?? {
      code: "",
      name: "",
      type: "DRESS",
      categoryId: null,
      salePrice: null,
      rentalPrice: null,
      cost: null,
      description: "",
    },
  });
  const selectedCategoryId = useWatch({
    control: form.control,
    name: "categoryId",
  });

  useEffect(() => {
    if (!selectedCategoryId) return;

    const currentCode = (form.getValues("code") ?? "").trim();
    if (hasManualCodeEdit.current && currentCode) return;

    const currentRequestId = ++suggestionRequestId.current;
    void (async () => {
      const result = await getSuggestedProductCode(selectedCategoryId);
      if (!result.success) return;
      if (currentRequestId !== suggestionRequestId.current) return;

      isApplyingSuggestion.current = true;
      form.setValue("code", result.data.code, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      isApplyingSuggestion.current = false;
    })();
  }, [form, selectedCategoryId]);

  async function onSubmit(data: ProductFormData) {
    const result = isEdit
      ? await updateProduct(productId, data)
      : await createProduct(data);

    if (result.success) {
      toast.success(isEdit ? "Producto actualizado exitosamente" : "Producto creado exitosamente");
      router.push(isEdit ? `/productos/${productId}` : "/productos");
    } else {
      toast.error(result.error);
    }
  }

  const categoryColumns: EntitySelectorColumn<Category>[] = [
    { key: "name", header: "Nombre", cell: (c) => c.name },
    { key: "code", header: "Código", cell: (c) => c.code, className: "w-[100px]" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del producto</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="VG-001"
                        name={field.name}
                        value={field.value}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        onChange={(e) => {
                          if (!isApplyingSuggestion.current) {
                            hasManualCodeEdit.current = true;
                          }
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del producto" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <FormControl>
                      <EntitySelectorTrigger
                        placeholder="Sin categoría"
                        displayValue={categories.find((c) => c.id === field.value)?.name}
                        onClick={() => setCategorySelectorOpen(true)}
                        onClear={() => field.onChange(null)}
                      />
                    </FormControl>
                    <EntitySelectorModal
                      open={categorySelectorOpen}
                      onOpenChange={setCategorySelectorOpen}
                      title="Seleccionar Categoría"
                      searchPlaceholder="Buscar categoría..."
                      items={categories}
                      columns={categoryColumns}
                      searchFilter={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
                      getItemId={(c) => c.id}
                      selectedId={field.value ?? undefined}
                      onSelect={(c) => field.onChange(c.id)}
                      allowCreate
                      createLabel="Crear categoría"
                      renderCreateForm={({ onCreated, onCancel }) => (
                        <CategoryQuickForm onCreated={onCreated} onCancel={onCancel} />
                      )}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="salePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Venta</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        placeholder="$0"
                        onValueChange={(value) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rentalPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Alquiler</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        placeholder="$0"
                        onValueChange={(value) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        placeholder="$0"
                        onValueChange={(value) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descripción del producto..." rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(isEdit ? `/productos/${productId}` : "/productos")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Guardar Cambios" : "Guardar Producto"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
