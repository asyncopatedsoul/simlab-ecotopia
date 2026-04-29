import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBlobStore } from './blobs';
import { LARGE_BLOB_THRESHOLD_BYTES } from './types';

class FakeWritable {
  constructor(private file: FakeFile) {}
  async write(data: Blob | BufferSource): Promise<void> {
    let bytes: Uint8Array<ArrayBuffer>;
    if (data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer());
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      const fresh = new Uint8Array(data.byteLength);
      fresh.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      bytes = fresh;
    } else {
      throw new Error('FakeWritable.write: unsupported data type');
    }
    this.file.bytes = bytes;
  }
  async close(): Promise<void> {}
}

class FakeFile {
  kind = 'file' as const;
  bytes: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  constructor(public name: string) {}
  async getFile(): Promise<File> {
    return new File([this.bytes], this.name);
  }
  async createWritable(): Promise<FakeWritable> {
    this.bytes = new Uint8Array(0);
    return new FakeWritable(this);
  }
}

class FakeDir {
  kind = 'directory' as const;
  entries = new Map<string, FakeDir | FakeFile>();
  constructor(public name: string) {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDir> {
    const existing = this.entries.get(name);
    if (existing instanceof FakeDir) return existing;
    if (existing) throw new DOMException('not a directory', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('not found', 'NotFoundError');
    const dir = new FakeDir(name);
    this.entries.set(name, dir);
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFile> {
    const existing = this.entries.get(name);
    if (existing instanceof FakeFile) return existing;
    if (existing) throw new DOMException('not a file', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('not found', 'NotFoundError');
    const file = new FakeFile(name);
    this.entries.set(name, file);
    return file;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.entries.delete(name)) throw new DOMException('not found', 'NotFoundError');
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, FakeDir | FakeFile]> {
    for (const entry of this.entries) yield entry;
  }
}

function installFakeOpfs(): FakeDir {
  const root = new FakeDir('');
  Object.defineProperty(globalThis.navigator, 'storage', {
    configurable: true,
    value: {
      getDirectory: async () => root as unknown as FileSystemDirectoryHandle,
      estimate: async () => ({ usage: 0, quota: 0 }),
      persist: async () => false,
      persisted: async () => false,
    },
  });
  return root;
}

async function readBytes(b: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(b);
  });
}

describe('LARGE_BLOB_THRESHOLD_BYTES', () => {
  it('is 10 MiB', () => {
    expect(LARGE_BLOB_THRESHOLD_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('blob store', () => {
  let store: Awaited<ReturnType<typeof createBlobStore>>;
  beforeEach(async () => {
    installFakeOpfs();
    store = await createBlobStore();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis.navigator, 'storage');
  });

  it('round-trips a Uint8Array blob', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    await store.put('photos/2026/test.bin', data);
    const got = await store.get('photos/2026/test.bin');
    expect(got).toBeInstanceOf(Blob);
    const bytes = await readBytes(got!);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns undefined for missing paths', async () => {
    expect(await store.get('nope/nope.bin')).toBeUndefined();
  });

  it('list returns paths recursively', async () => {
    await store.put('a/x.bin', new Uint8Array([1]));
    await store.put('a/b/y.bin', new Uint8Array([2]));
    await store.put('z.bin', new Uint8Array([3]));
    expect((await store.list()).sort()).toEqual(['a/b/y.bin', 'a/x.bin', 'z.bin']);
    expect((await store.list('a')).sort()).toEqual(['a/b/y.bin', 'a/x.bin']);
  });

  it('delete is idempotent', async () => {
    await store.delete('never-existed');
    await store.put('p.bin', new Uint8Array([1]));
    await store.delete('p.bin');
    expect(await store.get('p.bin')).toBeUndefined();
  });

  it('bytesUsed sums file sizes recursively', async () => {
    await store.put('a/x.bin', new Uint8Array(1024));
    await store.put('a/b/y.bin', new Uint8Array(2048));
    expect(await store.bytesUsed()).toBe(3072);
  });

  it('overwrites on second put', async () => {
    await store.put('p.bin', new Uint8Array([1, 2, 3]));
    await store.put('p.bin', new Uint8Array([9, 9]));
    const got = await store.get('p.bin');
    expect(await readBytes(got!)).toEqual(new Uint8Array([9, 9]));
  });
});
