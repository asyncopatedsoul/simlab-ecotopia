/**
 * sha256 of an ArrayBuffer / Uint8Array / Blob, returned as lowercase hex.
 *
 * Uses SubtleCrypto on the main thread. For very large bundles this could be
 * offloaded to a Web Worker — the design doc calls for it — but main-thread
 * digest is non-blocking enough for the MVP file sizes (per-file ≤ a few MB
 * after KTX2/Draco/Opus compression). If perf benchmarks flag it, swap in
 * a worker behind this same function signature without touching callers.
 */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed view so SubtleCrypto.digest accepts
  // it on every runtime. Node's crypto rejects views over non-ArrayBuffer
  // backings; jsdom's Buffer-extending Uint8Array can stumble on its runtime
  // instanceof check.
  const buf =
    data instanceof Blob
      ? await blobToArrayBuffer(data)
      : data instanceof Uint8Array
        ? data
        : data;
  const fresh: Uint8Array<ArrayBuffer> = new Uint8Array(
    buf instanceof Uint8Array ? buf.byteLength : buf.byteLength,
  );
  fresh.set(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const digest = await crypto.subtle.digest('SHA-256', fresh);
  return bytesToHex(new Uint8Array(digest));
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    hex += b < 16 ? '0' + b.toString(16) : b.toString(16);
  }
  return hex;
}
