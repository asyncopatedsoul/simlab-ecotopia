import type { BlobStore } from './types';

/**
 * Walks a slash-delimited path inside the OPFS root, creating intermediate
 * directories as needed. Returns the final directory handle and the leaf name.
 */
async function resolveDir(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<{ dir: FileSystemDirectoryHandle; name: string } | null> {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) throw new Error(`Invalid blob path: ${JSON.stringify(path)}`);
  const name = parts.pop()!;
  let dir = root;
  for (const seg of parts) {
    try {
      dir = await dir.getDirectoryHandle(seg, { create });
    } catch {
      if (!create) return null;
      throw new Error(`Failed to descend into ${seg} of ${path}`);
    }
  }
  return { dir, name };
}

async function listRecursive(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: string[],
): Promise<void> {
  for await (const [name, handle] of (dir as unknown as AsyncIterable<
    [string, FileSystemHandle]
  >)) {
    const childPath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      out.push(childPath);
    } else {
      await listRecursive(handle as FileSystemDirectoryHandle, childPath, out);
    }
  }
}

async function dirSizeRecursive(dir: FileSystemDirectoryHandle): Promise<number> {
  let total = 0;
  for await (const [, handle] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      total += file.size;
    } else {
      total += await dirSizeRecursive(handle as FileSystemDirectoryHandle);
    }
  }
  return total;
}

export async function createBlobStore(): Promise<BlobStore> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    throw new Error('OPFS unavailable: navigator.storage.getDirectory is not present.');
  }
  const root = await navigator.storage.getDirectory();

  return {
    async put(path, data) {
      const r = await resolveDir(root, path, true);
      if (!r) throw new Error(`put: cannot resolve ${path}`);
      const fileHandle = await r.dir.getFileHandle(r.name, { create: true });
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(data);
      } finally {
        await writable.close();
      }
    },
    async get(path) {
      const r = await resolveDir(root, path, false);
      if (!r) return undefined;
      try {
        const handle = await r.dir.getFileHandle(r.name);
        return await handle.getFile();
      } catch {
        return undefined;
      }
    },
    async delete(path) {
      const r = await resolveDir(root, path, false);
      if (!r) return;
      try {
        await r.dir.removeEntry(r.name);
      } catch {
        /* not found — idempotent delete */
      }
    },
    async list(prefix) {
      const out: string[] = [];
      if (!prefix) {
        await listRecursive(root, '', out);
        return out;
      }
      const r = await resolveDir(root, prefix, false);
      if (!r) return out;
      try {
        const sub = await r.dir.getDirectoryHandle(r.name);
        await listRecursive(sub, prefix, out);
        return out;
      } catch {
        return out;
      }
    },
    async bytesUsed() {
      return dirSizeRecursive(root);
    },
  };
}
