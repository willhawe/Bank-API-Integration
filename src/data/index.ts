export type { SpendingRepository } from "./SpendingRepository";
export { MockSpendingRepository } from "./MockSpendingRepository";
export { TrueLayerRepository } from "./TrueLayerRepository";

import { MockSpendingRepository } from "./MockSpendingRepository";
import { TrueLayerRepository } from "./TrueLayerRepository";

const TOKEN_KEY = "spending-tracker:tl-token";
const EXPIRES_KEY = "spending-tracker:tl-expires";

export function createSpendingRepository() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = Number(localStorage.getItem(EXPIRES_KEY) ?? 0);
  if (token && Date.now() < expires) {
    return new TrueLayerRepository(token);
  }
  return new MockSpendingRepository();
}

export function saveTrueLayerToken(token: string, expiresAt: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function clearTrueLayerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function hasTrueLayerToken(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = Number(localStorage.getItem(EXPIRES_KEY) ?? 0);
  return !!token && Date.now() < expires;
}
