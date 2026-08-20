import { useMemo, useState } from "react";
import { LayoutList } from "lucide-react";
import { SuperTable } from "@/components/SuperTable";
import { ListInfo } from "@/store/useTableStore";
import { buildEntityListVariables } from "@/lib/tableUtils";
import { GET_ENTITIES } from "@/graphql/query/entities/entitiesQueries";
import type { Entity } from "@/mocks/entities.types";
import { createEntityColumns } from "./entity.columns";
import { EntityDetailSheet } from "./EntityDetailSheet";

const EMPTY_FILTER: ListInfo["filters"] = {};

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
        query={GET_ENTITIES}
        accessorKey="entities"
        variablesBuilder={buildEntityListVariables}
        emptyState={{
          message: "Nothing has been extracted yet",
          icon: <LayoutList className="h-8 w-8" />,
        }}
      />
      <EntityDetailSheet entity={selectedEntity} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
