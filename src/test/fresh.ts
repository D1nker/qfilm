import { vi } from "vitest";

/// Les composables gardent leur état au niveau du module : chaque test repart d'une copie neuve.
export async function fresh<T>(load: () => Promise<T>): Promise<T> {
  vi.resetModules();
  return load();
}
