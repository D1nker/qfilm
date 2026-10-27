export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): [K, T[]][] {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const bucket = groups.get(key(item)) ?? [];
    bucket.push(item);
    groups.set(key(item), bucket);
  }
  return [...groups.entries()];
}
