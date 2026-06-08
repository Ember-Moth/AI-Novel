export function resolveVisibleSnapshot<TKey extends string, TValue>(
  cache: Map<TKey, TValue>,
  key: TKey | null | undefined,
  latest: TValue | undefined,
) {
  if (!key) {
    return undefined;
  }

  if (latest !== undefined) {
    cache.set(key, latest);
    return latest;
  }

  return cache.get(key);
}
