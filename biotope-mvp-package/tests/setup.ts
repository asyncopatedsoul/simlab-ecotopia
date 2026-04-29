import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// @testing-library/react auto-cleanup requires vitest globals; since this
// project uses globals:false we wire it here once for all test files.
afterEach(() => {
  cleanup();
});
