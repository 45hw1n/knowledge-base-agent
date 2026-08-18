# Cortex Frontend Rules (rules.md)

This document defines **strict coding rules** for the Cortex frontend.

All AI coding assistants must follow these rules when generating or modifying code.

These rules override default AI behavior.

---

# 1. Technology Stack Rules

The frontend must use the following technologies:

React (Vite)
React Router
GraphQL
Apollo Client
Tailwind CSS
SCSS
shadcn/ui

Do not introduce additional UI frameworks.

Do not use:

Material UI
Ant Design
Bootstrap
styled-components

---

# 2. UI Design System Rules

The UI system is built using **shadcn/ui primitives**.

All primitives must live inside:

src/lib/ui

Examples:

button.jsx
dialog.jsx
input.jsx
table.jsx
dropdown-menu.jsx

Example usage:

import { Button } from "@/lib/ui/button"

Rules:

- shadcn components must remain **pure UI primitives**
- They must **not contain business logic**
- They may only contain UI state (open/close, toggle, etc)

---

# 3. UI Layer Rules

The UI architecture must follow three layers.

Layer 1 — UI primitives

src/lib/ui

Examples:

Button
Dialog
Input
Table
DropdownMenu
Tabs

These are the **design system components**.

---

Layer 2 — Shared components

src/components

Examples:

PageHeader
ConfirmDialog
EmptyState
Loader
AppLayout

These may wrap shadcn primitives.

---

Layer 3 — Feature components

src/features/\*/components

Examples:

TransactionCard
InboxList
AccountCard

Feature components may compose:

- UI primitives
- shared components
- feature hooks

---

# 4. Folder Structure Rules

The root structure must follow this architecture.

src/

app/
components/
features/
lib/
styles/

Explanation:

app → application initialization and router
components → shared reusable UI components
features → domain features and business logic
lib → low-level libraries and UI primitives
styles → global styles

Do not create alternative folder structures.

---

# 5. Feature Organization Rules

Each feature must follow this structure:

features/<feature-name>/

api/
components/
hooks/
utils/

Explanation:

api → GraphQL queries and mutations
components → feature UI components
hooks → feature hooks
utils → feature utilities

Rules:

- Business logic must live inside features
- GraphQL queries must live inside feature api folders
- Hooks must live inside feature hooks folders

---

# 6. GraphQL Rules

GraphQL operations must be colocated with their features.

Correct:

features/inbox/api/queries.js
features/accounts/api/mutations.js

Incorrect:

graphql/queries.js
graphql/mutations.js

The global Apollo client must live at:

src/lib/graphql/client.js

---

# 7. Routing Rules

Routing must be implemented using **React Router**.

Router configuration must live in:

src/app/router.jsx

Routes must follow this structure:

/login
/onboarding

/home
/inbox
/inbox/rejected
/accounts

Rules:

- `/login` is public
- All other routes are protected
- If user is authenticated but not onboarded → redirect to `/onboarding`

---

# 8. Authentication Rules

Authentication state must be determined using:

getCurrentUser
getAppStatus

Logic:

If user is null → redirect to `/login`.

If user exists but not onboarded → redirect to `/onboarding`.

Otherwise allow access to the application.

---

# 9. Pages Rules

Pages are **route containers only**.

Pages must live in:

src/app/pages

Pages must:

- compose feature components
- avoid business logic
- avoid direct GraphQL queries

Example:

src/app/pages/Inbox.jsx

This page must import UI from:

src/features/inbox/components

---

# 10. Hooks Rules

Custom hooks must encapsulate reusable logic.

Feature hooks:

features/inbox/hooks/usePendingTransactions.js

Shared hooks:

src/lib/hooks/useAuthGuard.js

Hooks should:

- encapsulate data fetching
- avoid UI rendering
- return clean data structures

---

# 11. Styling Rules

Styling uses **Tailwind CSS and SCSS**.

Tailwind must be used for:

- layout
- spacing
- responsive design
- UI primitives
- shadcn components

Examples:

flex
grid
gap-4
p-4
text-sm

SCSS must be used for:

- global styles
- complex styling
- animations
- feature-specific styles

Global stylesheet:

src/styles/main.scss

Rules:

- Avoid inline styles
- Prefer Tailwind utilities for UI styling
- Use SCSS only when Tailwind is insufficient

---

# 12. Naming Conventions

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

# 13. Inbox Feature Rules

Inbox handles transactions detected from processed emails.

Transaction states:

Pending
Approved
Rejected

Rules:

Users approve transactions in Inbox.

Rejected transactions must appear in:

/inbox/rejected

---

# 14. Accounts Feature Rules

Accounts manages financial instruments.

Supported entities:

Bank accounts
Credit cards
Debit cards
UPI IDs

Users must be able to:

- add instruments
- edit instruments
- associate instruments with transactions

---

# 15. Development Principles

Follow these principles:

- Keep components small
- Prefer composition
- Keep business logic inside features
- Use shadcn primitives for UI
- Avoid large monolithic components
- Maintain separation between UI primitives and business logic

---

# 16. Future Scalability

The architecture must support future modules such as:

transactions
insights
rules
settings

These must be implemented under:

src/features/
