import {
  createBlobStore,
  createQuotaObserver,
  createSpeciesDB,
  type BlobStore,
  type SpeciesDB,
} from '@engine/storage';

const out = document.getElementById('out')!;

function log(line: string, cls?: 'ok' | 'fail') {
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = line + '\n';
  out.appendChild(span);
}

function clear() {
  out.textContent = '';
}

async function benchBlobRoundTrip(): Promise<void> {
  const store: BlobStore = await createBlobStore();
  const SIZE = 50 * 1024 * 1024;
  const data = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i += 1024) data[i] = i & 0xff;
  const path = `bench/blob-${Date.now()}.bin`;

  const t0 = performance.now();
  await store.put(path, data);
  const tWrite = performance.now() - t0;

  const t1 = performance.now();
  const got = await store.get(path);
  const tRead = performance.now() - t1;

  if (!got) {
    log('FAIL: blob not found after put', 'fail');
    return;
  }

  const total = tWrite + tRead;
  const target = 500;
  const verdict = total < target ? 'ok' : 'fail';
  log(
    `50 MiB OPFS round-trip: write=${tWrite.toFixed(0)}ms read=${tRead.toFixed(0)}ms total=${total.toFixed(0)}ms (target <${target}ms)`,
    verdict,
  );
  await store.delete(path);
}

async function benchSpeciesQuery(): Promise<void> {
  const path = `bench-species-${Date.now()}.sqlite3`;
  const db: SpeciesDB = await createSpeciesDB(path);
  try {
    await db.exec(
      'CREATE TABLE species (id INTEGER PRIMARY KEY, common TEXT, latin TEXT, region TEXT)',
    );
    await db.exec('CREATE INDEX idx_region ON species(region)');

    const N = 10_000;
    const tInsert0 = performance.now();
    for (let i = 0; i < N; i += 500) {
      const tuples: string[] = [];
      const params: (string | number)[] = [];
      for (let j = 0; j < 500 && i + j < N; j++) {
        const id = i + j;
        tuples.push('(?, ?, ?, ?)');
        params.push(id, `Common ${id}`, `Latinus ${id}`, `region-${id % 10}`);
      }
      await db.exec(`INSERT INTO species VALUES ${tuples.join(',')}`, params);
    }
    const tInsert = performance.now() - tInsert0;
    log(`Inserted ${N.toLocaleString()} rows in ${tInsert.toFixed(0)}ms`);

    // Warm-up.
    await db.query('SELECT * FROM species WHERE region = ? LIMIT 100', ['region-3']);

    const t0 = performance.now();
    const rows = await db.query('SELECT * FROM species WHERE region = ? LIMIT 1000', [
      'region-3',
    ]);
    const tQuery = performance.now() - t0;

    const target = 50;
    const verdict = tQuery < target ? 'ok' : 'fail';
    log(
      `species query (${rows.length} rows from ${N}): ${tQuery.toFixed(1)}ms (target <${target}ms)`,
      verdict,
    );
  } finally {
    await db.close();
  }
}

async function benchQuotaObserver(): Promise<void> {
  let firedSnap: { ratio: number } | null = null;
  let usage = 0;
  const observer = createQuotaObserver({
    pollIntervalMs: 100,
    estimate: async () => ({ usage, quota: 1_000_000 }),
  });
  const off = observer.onThreshold(0.8, (s) => {
    firedSnap = s;
  });

  await new Promise((r) => setTimeout(r, 150));
  if (firedSnap) {
    log('FAIL: observer fired before threshold crossed', 'fail');
    off();
    observer.stop();
    return;
  }
  usage = 850_000;
  await new Promise((r) => setTimeout(r, 200));
  off();
  observer.stop();
  if (firedSnap) {
    const s = firedSnap as { ratio: number };
    log(`quota observer fired at ratio=${s.ratio.toFixed(2)} (>=0.80)`, 'ok');
  } else {
    log('FAIL: observer did not fire after crossing threshold', 'fail');
  }
}

document.getElementById('run-blob')!.addEventListener('click', () => {
  clear();
  benchBlobRoundTrip().catch((e) => log(`error: ${e}`, 'fail'));
});
document.getElementById('run-species')!.addEventListener('click', () => {
  clear();
  benchSpeciesQuery().catch((e) => log(`error: ${e}`, 'fail'));
});
document.getElementById('run-quota')!.addEventListener('click', () => {
  clear();
  benchQuotaObserver().catch((e) => log(`error: ${e}`, 'fail'));
});
document.getElementById('run-all')!.addEventListener('click', async () => {
  clear();
  log('=== blob ===');
  await benchBlobRoundTrip().catch((e) => log(`error: ${e}`, 'fail'));
  log('\n=== species ===');
  await benchSpeciesQuery().catch((e) => log(`error: ${e}`, 'fail'));
  log('\n=== quota ===');
  await benchQuotaObserver().catch((e) => log(`error: ${e}`, 'fail'));
});
