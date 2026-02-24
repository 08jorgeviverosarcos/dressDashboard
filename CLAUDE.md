# CLAUDE.md — Project Constitution (InfoWorld / Dress Dashboard)

This document defines the **absolute rules** Claude must follow when working in this repository.
It is the single source of truth for architecture, conventions, and refactor constraints.

Claude must read and obey this file before making any changes.

---

## 1. Project Overview

This is a **Next.js App Router** dashboard for managing a dress rental and sales business.

**Core characteristics:**
- Internal business dashboard (not a public API)
- Uses **Server Actions** (no `/api/*` routes)
- Strong emphasis on **data integrity**, **financial correctness**, and **non-breaking refactors**

---

## 2. Tech Stack (Do NOT change)

### Frameworks & Tools
- Next.js 16 (App Router)
- TypeScript
- PostgreSQL
- Prisma ORM
- Zod (validation)
- React Hook Form
- Tailwind CSS
- shadcn/ui
- Sonner (toasts)
- Recharts (charts)

### Forbidden changes
- ❌ Do NOT introduce new frameworks
- ❌ Do NOT migrate to API routes
- ❌ Do NOT add state managers (Redux, Zustand, etc.)
- ❌ Do NOT add dependency injection frameworks

---

## 3. Architecture Rules (CRITICAL)

### Layered architecture (MANDATORY)

UI (Server + Client Components)
↓
Server Actions (thin adapters)
↓
Feature Services (business flow)
↓
Feature Repositories (Prisma queries only)
↓
Database

### Responsibilities per layer

#### Server Actions (`src/lib/actions`)
- Handle **Zod validation**
- Handle **revalidatePath**
- Return **ActionResult**
- Call services
- Import Next.js APIs

❌ Must NOT contain business logic  
❌ Must NOT contain Prisma queries (after refactor)

---

#### Services (`src/features/*/*.service.ts`)
- Orchestrate business rules
- Coordinate transactions
- Call repositories
- May call pure business helpers

❌ Must NOT import Next.js APIs  
❌ Must NOT parse FormData  
❌ Must NOT run Zod schemas  
❌ Must NOT access the filesystem

---

#### Repositories (`src/features/*/*.repo.ts`)
- Prisma queries ONLY
- No business logic
- No transactions orchestration (queries only)

❌ Must NOT import Zod  
❌ Must NOT import Next.js APIs  
❌ Must NOT contain revalidatePath  
❌ Must NOT format or transform data

---

## 4. Refactor Rules (NON-NEGOTIABLE)

### Mechanical refactor only
All refactors must be **MOVE + DELEGATE**.

Claude must:
- Copy logic verbatim
- Preserve behavior exactly
- Preserve error messages exactly
- Preserve Prisma queries EXACTLY (where/include/orderBy/select/take)
- Preserve transaction style EXACTLY (callback vs batch array)

❌ Do NOT rewrite logic  
❌ Do NOT “improve” code  
❌ Do NOT normalize or optimize queries  
❌ Do NOT change control flow  

---

## 5. Validation Rules

- Zod schemas live in `src/lib/validations`
- Zod validation **stays where it is today**
- Services receive **already validated data**

❌ Services must NOT parse FormData  
❌ Services must NOT run Zod schemas  

---

## 6. Transactions

- Transaction style must be preserved **per function**
  - If the original code uses `prisma.$transaction(async (tx) => ...)`, keep it
  - If the original code uses `prisma.$transaction([ ... ])`, keep it

- Repositories may accept a `tx` client but must not decide transaction boundaries

❌ Do NOT change transaction type  
❌ Do NOT introduce nested transactions  

---

## 7. ActionResult Contract (ABSOLUTE)

All server actions return:

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

Rules:
- Do NOT add fields
- Do NOT rename fields
- Do NOT leak internal data (e.g. orderId, _orderId)
- UI-facing shape must remain identical

---

## 8. Prisma Rules

- `schema.prisma` is the single source of truth
- Relations must use `connect` / `disconnect`
- Never assign foreign keys directly

❌ Do NOT modify migrations unless explicitly requested  
❌ Do NOT infer new relations  

---

## 9. Naming Conventions

### Files
- `feature.repo.ts`
- `feature.service.ts`
- `feature.strings.ts`

### Functions
- Verbs first: `getOrder`, `createPayment`, `updateInventoryStatus`
- No abbreviations
- No generic names like `handle`, `process`, `execute`

---

## 10. Strings & UI Text

- No hardcoded strings in components
- Feature-specific strings go in `features/<feature>/<feature>.strings.ts`
- Common strings go in `src/strings/*`

❌ Do NOT embed Spanish UI strings inside logic files  

---

## 11. Component Rules

### Reusable components
Location:
src/components/ui
src/components/layout
src/components/shared

Rules:
- No business knowledge
- No API calls
- No direct imports from `features/*`

---

### Feature components
Location:
src/features/<feature>/components

Rules:
- May know business concepts
- May call server actions

---

## 12. Testing & Verification

After each phase or module, assume these **manual smoke tests**:
- List page loads correctly
- Create works
- Update works
- Delete guards behave the same
- No change in error messages
- No regression in totals or payments

Claude must STOP after each phase and summarize changes.

---

## 13. Execution Rules for Claude Code

- Prefer **Plan Mode** (`/plan`) for analysis
- Execution must be **phase by phase**
- Use **manual approval** for edits
- Never auto-accept edits
- Never clear context

If unsure, Claude must ASK before acting.

---

## 14. Prohibited Patterns

❌ Clean Architecture / Hexagonal / Ports & Adapters  
❌ Dependency Injection containers  
❌ Event buses  
❌ Background jobs (unless explicitly requested)  
❌ Refactors mixed with feature changes  

---

## 15. Final Rule

If a change could alter runtime behavior, financial correctness, or data integrity:
**DO NOT DO IT** unless explicitly instructed.

When in doubt: **STOP AND ASK**.

---

## 16. Soft Delete (Logical Deletion)

All data is **never permanently deleted** from the database. Records are marked with `deletedAt` instead.

### Models with soft delete
All models **except `AuditLog`** have `deletedAt DateTime?` and `@@index([deletedAt])`:
- `Client`, `Category`, `Product`, `InventoryItem`
- `Order`, `OrderItem`, `Payment`, `Expense`
- `Rental`, `RentalCost`

`AuditLog` is **immutable** — it has no `deletedAt` and is never deleted.

### New models
Every new model (except audit/immutable ones) **must** include:
```prisma
deletedAt DateTime?
@@index([deletedAt])
```

### Extension (automatic read filtering)
`src/lib/prisma.ts` uses Prisma Client Extensions (`$extends`) that:
- Adds `where: { deletedAt: null }` automatically to top-level `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`

**Not handled by the extension (must be explicit in repos):**
- `delete` → must use `update { where, data: { deletedAt: new Date() } }`
- `deleteMany` → must use `updateMany { where, data: { deletedAt: new Date() } }`
- `findUnique` → must use `findFirst` instead (extension cannot add non-unique fields to `findUnique` where)

❌ Never use `delete`, `deleteMany`, or `findUnique` on soft-delete models in repos
❌ Never use hard deletes in application code (seed `prisma/seed.ts` is the only exception)

### Nested includes (hasMany only)
All **hasMany** nested includes must add `where: { deletedAt: null }` to exclude soft-deleted children.
BelongsTo/hasOne includes do NOT need this (middleware does not filter them).

```typescript
// correct
items: { where: { deletedAt: null }, include: { product: true } }

// incorrect — soft-deleted items would appear
items: { include: { product: true } }
```

### Cascade soft delete
DB-level cascade (`onDelete: Cascade`, `onDelete: SetNull`) does **not** fire for soft deletes because no real `DELETE` is issued. Cascade must be done **explicitly in repos**:

1. Soft-delete children before the parent
2. Use `updateMany`/`update` directly with `data: { deletedAt: new Date() }` (not `deleteMany`/`delete`) to avoid double middleware interception
3. For `onDelete: SetNull` relations (e.g., `Rental.orderItemId`), explicitly null out the FK before soft-deleting the parent item
