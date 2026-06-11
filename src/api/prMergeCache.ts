import { clear, createStore, del, get, keys, set } from 'idb-keyval';

const DB_NAME = 'gi.prs';
const STORE_NAME = 'chunks';

const idbStore = createStore(DB_NAME, STORE_NAME);

export type CachedMergedPrEntry = {
  id: number;
  number: number;
  repoFullName: string;
  title: string;
  mergedAt: string;
  htmlUrl: string;
};

export type MergedPrMonthChunk = {
  month: string;
  login: string;
  byDate: Record<string, number>;
  prs: CachedMergedPrEntry[];
  latestMergedAt: string | null;
  fetchedAt: string;
  truncated: boolean;
};

function chunkKey(login: string, month: string): string {
  return `v1:${login}:${month}`;
}

function loginPrefix(login: string): string {
  return `v1:${login}:`;
}

export async function getPrMonthChunk(
  login: string,
  month: string,
): Promise<MergedPrMonthChunk | null> {
  const row = await get<MergedPrMonthChunk>(chunkKey(login, month), idbStore);
  return row ?? null;
}

export async function setPrMonthChunk(chunk: MergedPrMonthChunk): Promise<void> {
  await set(chunkKey(chunk.login, chunk.month), chunk, idbStore);
}

export async function listCachedPrMonths(login: string): Promise<string[]> {
  const all = await keys<string>(idbStore);
  const p = loginPrefix(login);
  const months = all
    .filter((k) => k.startsWith(p))
    .map((k) => k.slice(p.length))
    .filter((m) => /^\d{4}-\d{2}$/.test(m));
  months.sort();
  return months;
}

export async function deleteAllPrChunks(login: string): Promise<void> {
  const all = await keys<string>(idbStore);
  const p = loginPrefix(login);
  await Promise.all(all.filter((k) => k.startsWith(p)).map((k) => del(k, idbStore)));
}

export async function clearPrCacheStore(): Promise<void> {
  try {
    await clear(idbStore);
  } catch {
    // best-effort
  }
}
