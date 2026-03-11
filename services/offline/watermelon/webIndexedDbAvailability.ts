export function hasIndexedDb() {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}