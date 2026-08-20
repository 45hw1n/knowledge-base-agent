import { useMemo, useState } from "react";
import { LayoutList } from "lucide-react";
import { SuperTable } from "@/components/SuperTable";
import { ListInfo } from "@/store/useTableStore";
import { applyClientSideProcessing } from "@/lib/tableUtils";
import { entitiesMock } from "@/mocks";
import type { Entity } from "@/mocks/entities.types";
import { createEntityColumns } from "./entity.columns";
import { EntityDetailSheet } from "./EntityDetailSheet";

const EMPTY_FILTER: ListInfo["filters"] = {};

// No backend API for entities yet (see decisions.md — the GraphQL surface
// for typed entities is still unwired). Rather than modify SuperTable
// itself to special-case a no-backend mode, this uses the extension point
// it already has for exactly this situation: `fetchDataOverride` — the
// same mechanism the Expense tracker project used for a mock/client-side
// data source (see DebitCardTable.tsx there). `query`/`accessorKey` are
// simply omitted.
//
// Reuses applyClientSideProcessing (the same helper SuperTable's own
// isListInfo={false} GraphQL path uses internally) rather than
// reimplementing pagination — swap this one line for a real GraphQL
// query + accessorKey once the entities API exists.
async function fetchDataOverride(listInfo: ListInfo) {
  return applyClientSideProcessing(entitiesMock, listInfo);
}

export function EntityList() {
  const [sheetOpen, setSheetOpen] = useState(false);
  // Kept set after close (not cleared to null) so the sheet's content
  // doesn't flash empty mid-close-animation — only `sheetOpen` controls
  // visibility.
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const columns = useMemo(
    () =>
      createEntityColumns((entity) => {
        setSelectedEntity(entity);
        setSheetOpen(true);
      }),
    []
  );

  return (
    <>
      <SuperTable
        id="entities"
        name="entities"
        columns={columns}
        defaultSort={null}
        defaultFilter={EMPTY_FILTER}
        defaultPageSize={10}
        fetchDataOverride={fetchDataOverride}
        emptyState={{
          message: "Nothing has been extracted yet",
          icon: <LayoutList className="h-8 w-8" />,
        }}
      />
      <EntityDetailSheet entity={selectedEntity} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
