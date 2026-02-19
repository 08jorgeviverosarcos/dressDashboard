export const EXPENSE_CATEGORIES: Record<string, string[]> = {
  "Materiales": [
    "Telas",
    "Hilos",
    "Botones y cremalleras",
    "Pedrería y apliques",
    "Forros",
    "Otros materiales",
  ],
  "Mano de obra": [
    "Costura",
    "Bordado",
    "Arreglos",
    "Patronaje",
  ],
  "Operaciones": [
    "Arriendo local",
    "Servicios públicos",
    "Internet y telefonía",
    "Seguros",
    "Mantenimiento",
  ],
  "Logística": [
    "Transporte",
    "Envíos",
    "Empaque",
    "Lavandería",
  ],
  "Marketing": [
    "Publicidad digital",
    "Redes sociales",
    "Fotografía",
    "Eventos",
  ],
  "Administración": [
    "Papelería",
    "Software y herramientas",
    "Contabilidad",
    "Legales",
  ],
  "Personal": [
    "Salarios",
    "Bonificaciones",
    "Seguridad social",
    "Capacitación",
  ],
  "Otros": [
    "Imprevistos",
    "Varios",
  ],
};

export const EXPENSE_CATEGORY_LIST = Object.keys(EXPENSE_CATEGORIES);

export function getSubcategories(category: string): string[] {
  return EXPENSE_CATEGORIES[category] ?? [];
}

export const RENTAL_COST_TYPES = [
  "Lavado",
  "Arreglo",
  "Transporte",
  "Multa",
  "Desgaste",
  "Otros",
];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  QUOTE: "Cotización",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En proceso",
  READY: "Listo para entrega",
  DELIVERED: "Entregado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANCOLOMBIA: "Bancolombia",
  NEQUI: "Nequi",
  DAVIPLATA: "DaviPlata",
  DAVIVIENDA: "Davivienda",
  BOLD_CARD: "Bold/Tarjeta",
  CREDIBANCO: "CrediBanco",
  CASH: "Efectvo",
  OTHER: "Otro",
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  DOWNPAYMENT: "Abono",
  INSTALLMENT: "Cuota",
  FINAL: "Pago final",
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  RENTAL: "Alquiler",
  SALE: "Venta",
  BOTH: "Ambos",
};


export const INVENTORY_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Disponible",
  RENTED: "Alquilado",
  SOLD: "Vendido",
  IN_REPAIR: "En reparación",
  RETIRED: "Retirado",
};

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fijo",
  VARIABLE: "Variable",
};

export const COST_SOURCE_LABELS: Record<string, string> = {
  INVENTORY: "Inventario",
  EXPENSES: "Gastos",
  MANUAL: "Manual",
};
