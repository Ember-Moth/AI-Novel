export type Updater<T> = T | ((current: T) => T);

export function resolveNext<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (current: T) => T)(current) : updater;
}
