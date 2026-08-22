import { useState } from "react";
import { ENTITY_TYPE_CONFIG } from "@/features/entities/entityDisplay";
import { EntityDetailSheet } from "@/features/entities/EntityDetailSheet";
import type { Entity } from "@/mocks/entities.types";
import type { ChatSource } from "@/lib/api/chatApi";

interface SourcesListProps {
  sources: ChatSource[];
}

// Reuses EntityDetailSheet as-is — it already generically fetches and
// renders all 5 entity types by id via GET_ENTITY_DETAIL, so no new
// detail-sheet component is needed here. The `entity` object passed in is
// intentionally minimal: EntityDetailSheet's own query fetches everything
// else by `entity.id`, which MUST be the source's `entityId` (Entity._id,
// the registry row) — never a typed child doc's own _id, or the sheet
// silently renders "No details found." See decisions.md.
function asEntity(source: ChatSource): Entity {
  return {
    id: source.entityId,
    type: source.type,
    displayId: source.displayId,
    title: source.title,
  } as Entity;
}

export function SourcesList({ sources }: SourcesListProps) {
  const [selected, setSelected] = useState<ChatSource | null>(null);

  if (!sources.length) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const Icon = ENTITY_TYPE_CONFIG[source.type]?.icon;
          return (
            <button
              key={source.entityId}
              type="button"
              onClick={() => setSelected(source)}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {Icon && <Icon className="h-3 w-3" />}
              {source.displayId}
            </button>
          );
        })}
      </div>
      <EntityDetailSheet
        entity={selected ? asEntity(selected) : null}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
