"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { expenseSchema, type ExpenseFormData } from "@/lib/validations/expense";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import {
  EXPENSE_CATEGORY_LIST,
  getSubcategories,
  PAYMENT_METHOD_LABELS,
  EXPENSE_TYPE_LABELS,
} from "@/lib/constants/categories";
import { Loader2 } from "lucide-react";

interface OrderOption {
  id: string;
  orderNumber: number;
}

interface ExpenseFormProps {
  orders: OrderOption[];
  initialData?: {
    id: string;
    date: string;
    category: string;
    subcategory: string;
    description: string;
    responsible: string;
    amount: number;
    expenseType: string;
    paymentMethod: string;
    orderId: string;
  };
}

export function ExpenseForm({ orders, initialData }: ExpenseFormProps) {
  const router = useRouter();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: initialData
      ? {
          date: new Date(initialData.date),
          category: initialData.category,
          subcategory: initialData.subcategory,
          description: initialData.description,
          responsible: initialData.responsible,
          amount: initialData.amount,
          expenseType: initialData.expenseType as "FIXED" | "VARIABLE",
          paymentMethod: initialData.paymentMethod as ExpenseFormData["paymentMethod"],
          orderId: initialData.orderId || "",
        }
      : {
          date: new Date(),
          category: "",
          subcategory: "",
          description: "",
          responsible: "",
          amount: 0,
          expenseType: "VARIABLE",
          paymentMethod: "CASH",
          orderId: "",
        },
  });

  const selectedCategory = form.watch("category");
  const subcategories = selectedCategory ? getSubcategories(selectedCategory) : [];

  async function onSubmit(data: ExpenseFormData) {
    const result = initialData
      ? await updateExpense(initialData.id, data)
      : await createExpense(data);

    if (result.success) {
      toast.success(initialData ? "Gasto actualizado" : "Gasto creado exitosamente");
      router.push("/gastos");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? "Editar Gasto" : "Información del gasto"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha *</FormLabel>
                  <FormControl>
                    <Input type="date" value={field.value instanceof Date ? field.value.toISOString().split("T")[0] : ""} onChange={(e) => field.onChange(new Date(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor *</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría *</FormLabel>
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("subcategory", ""); }}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EXPENSE_CATEGORY_LIST.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="subcategory" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategoría</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={subcategories.length === 0}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {subcategories.map((sub) => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción *</FormLabel>
                <FormControl>
                  <Input placeholder="Descripción del gasto" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField control={form.control} name="responsible" render={({ field }) => (
                <FormItem>
                  <FormLabel>Encargado</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="expenseType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(EXPENSE_TYPE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pago *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="orderId" render={({ field }) => (
              <FormItem>
                <FormLabel>Pedido Asociado (opcional)</FormLabel>
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>Pedido #{o.orderNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/gastos")}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? "Guardar Cambios" : "Crear Gasto"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
