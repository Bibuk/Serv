export interface CatalogEntity { id: string; name: string }

// Tasks and tickets reference related entities (team, service, application) by
// name when they come from the real API, or by mock id in mock mode. A filter
// stores the selected entity's id; this matches a stored task/ticket value
// against either the id or the resolved name so filtering works in both modes.
export function matchesEntity(value: string, selectedId: string, catalog: CatalogEntity[]): boolean {
  if (!selectedId) return true;
  const e = catalog.find(c => c.id === selectedId);
  if (!e) return value === selectedId;
  return value === e.id || value === e.name;
}
