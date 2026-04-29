import { describe, expect, it, vi } from 'vitest';
import { configureGLTFLoader, getDracoLoader, getKtx2Loader } from './loaders';

describe('loaders', () => {
  it('returns the same DRACOLoader on repeat calls (singleton)', () => {
    expect(getDracoLoader()).toBe(getDracoLoader());
  });

  it('returns the same KTX2Loader on repeat calls (singleton)', () => {
    expect(getKtx2Loader()).toBe(getKtx2Loader());
  });

  it('configureGLTFLoader wires Draco + KTX2 onto the GLTFLoader extension hook', () => {
    const setDRACOLoader = vi.fn();
    const setKTX2Loader = vi.fn();
    configureGLTFLoader({ setDRACOLoader, setKTX2Loader });
    expect(setDRACOLoader).toHaveBeenCalledOnce();
    expect(setKTX2Loader).toHaveBeenCalledOnce();
    expect(setDRACOLoader.mock.calls[0]?.[0]).toBe(getDracoLoader());
    expect(setKTX2Loader.mock.calls[0]?.[0]).toBe(getKtx2Loader());
  });
});
