# Plan de Reorganizacion UI/UX — Items del Pedido en Editar

## Contexto

Base documental: `thoughts/shared/research/2026-02-23_16-04-46_[general]_order-items-editar-organizacion-actual.md`.

Pantalla objetivo: `/pedidos/[id]/editar`  
Componentes foco:
- `src/components/orders/OrderForm.tsx`
- `src/components/orders/OrderItemRow.tsx`

Objetivo del plan: reorganizar la seccion de items para que la lectura y edicion sea mas clara, con jerarquia visual consistente y subtotal/totales en posiciones intuitivas.

---

## Objetivo UX (estado deseado)

1. Cada item se entiende en menos de 3 segundos: **que es**, **cuanto cuesta**, **cuanto suma**.
2. El subtotal del item queda anclado en la zona de calculo, sin competir con campos secundarios.
3. La accion de eliminar es visible pero no dominante.
4. La seccion de totales del pedido se percibe como cierre natural del bloque de items.
5. El layout mantiene coherencia para `SALE`, `RENTAL` y `SERVICE`.

---

## Propuesta de estructura (v2)

### Bloque de Item (OrderItemRow)

**Header del item**
- Izquierda: `Item N` + badge de tipo (`Venta`, `Alquiler`, `Servicio`).
- Derecha: accion `Eliminar` con icono + label corto (`Eliminar`), estilo destructivo sutil.

**Fila principal (datos troncales)**
- `Tipo`, `Producto/Nombre`, `Cantidad`, `Precio Unit.`, `Costo`
- **Subtotal del item** en una celda destacada al extremo derecho (mismo plano visual de precio/costo).

**Fila secundaria**
- `Descripcion`
- `Tipo descuento`
- `Descuento`

**Fila condicional rental**
- `Fecha Devolucion`
- `Deposito`

### Cierre de seccion (OrderForm)

- `Agregar Item` se mantiene antes del resumen.
- `Separator` + bloque de resumen fijo al final de la card:
  - `Total Precio` (peso visual alto)
  - `Total Costo`
- Mantener formato moneda y alineacion derecha.

---

## Alcance tecnico

### En alcance
- Reordenamiento visual/semantico de `OrderItemRow`.
- Ajuste de estilos (`className`) y jerarquia tipografica.
- Ajuste de ubicacion/estilo del subtotal del item.
- Ajuste del bloque de totales en `OrderForm`.

### Fuera de alcance
- Cambios de logica de negocio (calculos, validaciones, persistencia).
- Cambios de contratos `ActionResult`, schemas o capa repo/service.
- Cambios de rutas o arquitectura.

---

## Fases de implementacion

## Estado de ejecucion

- [x] Fase 1 implementada (wireframe/estructura JSX sin cambios de logica).
- [x] Fase 2 implementada (refinamiento visual: espaciados, jerarquia, accion eliminar no invasiva).
- [x] Fase 3 implementada (cierre de seccion y bloque de resumen en `OrderForm`).
- [x] Verificacion automatica ejecutada (`npm run lint`).
- [ ] Verificacion manual pendiente (checklist corto).

---

## Fase 1 — Wireframe en codigo (sin tocar logica)

**Objetivo**: reorganizar estructura JSX para jerarquia visual.

Cambios:
- `OrderItemRow`: reubicar header del item + accion eliminar.
- Consolidar fila principal y asegurar que subtotal quede visualmente asociado a precio/costo.
- Mantener mismas props, mismos handlers (`onChange`, `onRemove`) y mismo calculo de subtotal.

Validacion:
- Compila TypeScript.
- Sin cambios funcionales en edicion.

---

## Fase 2 — Refinamiento visual UI

**Objetivo**: mejorar escaneabilidad y consistencia.

Cambios:
- Ajustar espaciados (`space-y`, `gap`) para evitar ruido visual.
- Afinar labels y pesos tipograficos.
- Estilo de accion eliminar: visible, consistente y no invasivo.
- Destacar subtotal del item con tipografia/contraste moderado.

Validacion:
- Revision visual en desktop y breakpoint movil.
- Verificar que no hay truncamientos en labels/campos.

---

## Fase 3 — Cierre de seccion y resumen

**Objetivo**: que el cierre de card sea claro y ordenado.

Cambios:
- Revisar posicion y alineacion del bloque de totales (`Total Precio`, `Total Costo`) dentro de `OrderForm`.
- Confirmar separacion visual entre lista de items y resumen final.

Validacion:
- Totales siguen mostrando valores correctos (sin cambiar formula).
- Flujo visual: items -> agregar -> resumen -> acciones de formulario.

---

## Criterios de aceptacion

- [ ] El subtotal por item se identifica rapidamente dentro de cada bloque.
- [ ] La accion eliminar se encuentra facilmente y no desordena la grilla.
- [ ] Los campos principales (tipo, producto, cantidad, precio, costo) quedan en una sola lectura horizontal.
- [ ] Los campos secundarios (descripcion/descuento/rental) quedan claramente separados.
- [ ] El resumen final (`Total Precio` / `Total Costo`) se percibe como cierre de la seccion.
- [ ] No hay regresiones funcionales al crear/editar pedido.

---

## Verificacion manual (checklist corto)

1. Editar pedido con 3 items (SALE, RENTAL, SERVICE).
2. Confirmar que cada item se entiende visualmente sin desplazamientos innecesarios.
3. Modificar cantidad/precio/descuento y confirmar subtotal por item.
4. En item RENTAL, verificar visibilidad de `Fecha Devolucion` y `Deposito`.
5. Eliminar item intermedio y confirmar que el orden visual se mantiene.
6. Confirmar bloque final de totales y accion de guardar/cancelar.

---

## Riesgos controlados

- Riesgo de romper responsive del grid de 12 columnas.
- Riesgo de desalinear subtotal frente a campos monetarios.
- Riesgo de sobrecargar header del item en pantallas pequenas.

Mitigacion: cambios por fase + QA visual por breakpoints (`sm`, `md`, `lg`) antes de cerrar.

---

## Decision pendiente contigo

Decision tomada para esta implementacion:

- [x] **Eliminar solo con icono** (mas limpio)
- [ ] Eliminar con icono + texto (mas discoverable)

Aplicado en `OrderItemRow` con accion de eliminar de baja friccion visual.
