import { SuperColumnDef } from "@/components/SuperTable/SuperTable.types";
import { EntitySourceBadge, EntityTypeBadge, formatDate } from "./entityDisplay";
import type { Entity } from "@/mocks/entities.types";

// Resizing stays enabled on every column (SuperTable's drag-to-resize).
// The initial render width comes from `defaultWidth` (SuperTable falls
// back to 150px otherwise), clamped by minWidth/maxWidth — so widening
// `maxWidth` alone wouldn't move anything unless the default itself is
// raised too. Both are bumped here so the columns fill the table's width
// by default, while maxWidth still leaves headroom to drag them wider.
// Title gets the largest range since it's the most variable-length field.
//
// A factory (not a static array) so the Title cell can call back into
// EntityList's sheet-open state — the same "columns as a function of
// caller-supplied callbacks" convention the Expense tracker's
// DebitCardTable.tsx uses for its edit/delete actions.
export function createEntityColumns(onTitleClick: (entity: Entity) => void): SuperColumnDef<Entity, any>[] {
  return [
    {
      id: "displayId",
      accessorKey: "displayId",
      header: "ID",
      enableSorting: true,
      minWidth: 110,
      defaultWidth: 130,
      maxWidth: 260,
      cell: ({ row }) => <span className="font-mono text-sm">#{row.original.displayId}</span>,
    },
    {
      id: "type",
      accessorKey: "type",
      header: "Type",
      enableSorting: true,
      minWidth: 130,
      defaultWidth: 150,
      maxWidth: 300,
      cell: ({ row }) => <EntityTypeBadge type={row.original.type} />,
    },
    {
      // Nested path (source.type) — same shallow-lookup sorting caveat as
      // "date" below, so sorting stays off here too.
      id: "source",
      accessorKey: "source.type",
      header: "Source",
      minWidth: 130,
      defaultWidth: 150,
      maxWidth: 260,
      cell: ({ row }) => <EntitySourceBadge source={row.original.source} />,
    },
    {
      id: "title",
      accessorKey: "title",
      header: "Title",
      enableSorting: true,
      // Raised so dragging this column down (or other columns growing at its
      // expense) can't squeeze it into an unreadable sliver — it's the one
      // column holding variable-length free text, unlike the others.
      minWidth: 300,
      defaultWidth: 310,
      maxWidth: 900,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onTitleClick(row.original)}
          className="text-left hover:underline underline-offset-2"
        >
          {row.original.title}
        </button>
      ),
    },
    {
      // Nested path (extraction.extractedAt) — sorting disabled: the shared
      // client-side sort helper (applyClientSideProcessing) does a shallow
      // `row[key]` lookup, which can't resolve a dotted path. Not worth a
      // custom sort implementation for a mock table; flagged rather than
      // shipping a sort arrow that silently does nothing.
      id: "date",
      accessorKey: "extraction.extractedAt",
      header: "Date",
      minWidth: 110,
      defaultWidth: 130,
      maxWidth: 260,
      cell: ({ row }) => formatDate(row.original.extraction.extractedAt),
    },
    {
      id: "createdDate",
      accessorKey: "createdAt",
      header: "Created Date",
      enableSorting: true,
      minWidth: 130,
      defaultWidth: 150,
      maxWidth: 260,
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ];
}
