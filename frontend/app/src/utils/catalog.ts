export interface CatalogEntity { id: string; name: string }

export function matchesEntity(value: string, selectedId: string, catalog: CatalogEntity[]): boolean {
  if (!selectedId) return true;
  const e = catalog.find(c => c.id === selectedId);
  if (!e) return value === selectedId;
  return value === e.id || value === e.name;
}
