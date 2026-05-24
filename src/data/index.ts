export type { SpendingRepository } from "./SpendingRepository";
export { MockSpendingRepository } from "./MockSpendingRepository";

import { MockSpendingRepository } from "./MockSpendingRepository";

/** Single injection point — replace with SupabaseSpendingRepository later. */
export function createSpendingRepository(): MockSpendingRepository {
  return new MockSpendingRepository();
}
