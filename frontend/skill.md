# Cortex Frontend Skill Context (skill.md)

This document defines the **frontend architecture, product context, and development patterns** for the Cortex React application.

All AI coding assistants must follow these guidelines when generating code.

---

# 1. Tech Stack

The frontend uses the following technologies:

- React (Vite)
- React Router
- GraphQL
- Apollo Client
- SCSS
- shadcn/ui component system

Do not introduce new frameworks unless necessary.

Avoid UI libraries such as Material UI, Ant Design, or Bootstrap.

---

# 2. UI Design System

The design system is built using **shadcn/ui primitives**.

These primitives must be located in:

src/lib/ui

Example components:

button.jsx
dialog.jsx
input.jsx
table.jsx
dropdown-menu.jsx

Usage example:

import { Button } from "@/lib/ui/button"

Rules:

- UI primitives must **not contain business logic**
- They must remain **pure presentational components**
- They may only contain UI state (open/close, hover, etc)

---

# 3. UI Architecture Layers

The UI architecture follows three layers.

Layer 1 — UI primitives

src/lib/ui

These are design system components such as:

Button
Dialog
Input
Table
DropdownMenu
Tabs
Toast

These components come from shadcn and may be lightly customized.

---

Layer 2 — Shared UI components

src/components

Examples:

PageHeader
ConfirmDialog
EmptyState
Loader
AppLayout

These components may wrap shadcn primitives and are reusable across features.

---

Layer 3 — Feature components

src/features/\*/components

Examples:

TransactionCard
InboxList
AccountCard

These contain feature-specific UI and business interactions.

---

# 4. Application States

The application has three major states:

1. Unauthenticated
2. Authenticated but not onboarded
3. Authenticated and onboarded

These states are determined using GraphQL queries:

getCurrentUser
getAppStatus

Rules:

If user is not authenticated → redirect to `/login`

If user is authenticated but not onboarded → redirect to `/onboarding`

Only onboarded users may access the main application.

---

# 5. Routing

Routing is implemented using **React Router**.

Routes must follow this structure:

/login
/onboarding

/home
/inbox
/inbox/rejected
/accounts

Rules:

- All routes except `/login` are protected
- Routing configuration should live inside `src/app/router.jsx`

---

# 6. Project Architecture

The project follows a **feature-based architecture**.

src/

app/
features/
components/
lib/
styles/

Explanation:

app → application bootstrap and router
features → domain features
components → shared reusable UI components
lib → low-level libraries and UI primitives
styles → global SCSS

---

# 7. Feature Structure

Each feature must follow this structure:

features/<feature-name>/

api/
components/
hooks/
utils/

Example:

features/inbox/

api/queries.js
api/mutations.js

components/InboxList.jsx
components/TransactionCard.jsx

hooks/usePendingTransactions.js

utils/formatTransaction.js

Rules:

- GraphQL operations must stay inside the feature
- Hooks must stay inside the feature
- Business logic must stay inside the feature

---

# 8. GraphQL Organization

GraphQL operations must be colocated with their features.

Example:

features/inbox/api/queries.js
features/inbox/api/mutations.js

The global Apollo Client must live at:

src/lib/graphql/client.js

---

# 9. Pages vs Features

Pages are **route-level containers**.

Pages should:

- compose feature components
- contain minimal logic
- avoid business logic

Example:

src/app/pages/Inbox.jsx

This page should import components from:

src/features/inbox/components

---

# 10. Styling

The project uses **Tailwind CSS and SCSS together**.

Each tool has a specific responsibility.

---

## Tailwind CSS

Tailwind should be used for:

- shadcn/ui components
- layout utilities
- spacing
- flex/grid layout
- responsive behavior
- quick UI styling

Examples:

flex
grid
gap-4
p-4
text-sm
text-muted-foreground

Tailwind is the **default styling method for UI components**.

Example:

```jsx
<div className="flex items-center gap-2">
  <Button>Save</Button>
</div>
```

---

## SCSS

SCSS is used for:

- global styles
- complex styling rules
- animations
- overrides
- feature-specific styles

Global stylesheet:

src/styles/main.scss

Feature styles may be colocated with components:

features/inbox/components/InboxList.scss

---

## Styling Rules

1. Prefer **Tailwind for UI components**
2. Use **SCSS for complex styling**
3. Avoid inline styles
4. Avoid mixing Tailwind and SCSS excessively in the same component
5. Do not write CSS when a Tailwind utility already exists

# 11. Naming Conventions

Queries:

GET_CURRENT_USER
GET_PENDING_TRANSACTIONS

Mutations:

APPROVE_TRANSACTION
REJECT_TRANSACTION

Hooks:

useCurrentUser
usePendingTransactions

Components:

TransactionCard
InboxList

---

# 12. Development Principles

Follow these principles:

- Prefer small reusable components
- Keep business logic inside features
- Use shadcn UI primitives
- Keep pages thin
- Avoid large monolithic components
- Maintain separation between UI primitives and business logic

---

# 13. AI Code Generation Rules

When generating code:

1. Use shadcn primitives from `src/lib/ui`
2. Do not create new UI libraries
3. Place reusable UI inside `src/components`
4. Place feature-specific UI inside `src/features/<feature>/components`
5. Place GraphQL queries inside `features/<feature>/api`
6. Place hooks inside `features/<feature>/hooks`

Never mix feature logic with UI primitives.

---

# 14. Future Features

The architecture must support future modules such as:

transactions
insights
rules
settings

These must be added under:

src/features/
