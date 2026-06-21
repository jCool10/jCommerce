// Internal-only event (no contract counterpart in MVP) — used by future
// audit-trail consumers. Lives in domain because the change semantic is
// owned by the catalog bounded context.
export interface InventoryChangedEvent {
  version: 1;
  skuId: string;
  available: number;
  reserved: number;
  reason: 'RESERVE' | 'RELEASE' | 'RESTOCK' | 'UPSERT';
  occurredAt: string;
}

export const buildInventoryChangedV1 = (
  input: Omit<InventoryChangedEvent, 'version' | 'occurredAt'>,
): InventoryChangedEvent => ({
  version: 1,
  occurredAt: new Date().toISOString(),
  ...input,
});
