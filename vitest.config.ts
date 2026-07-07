import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // lets @testing-library/react auto-cleanup between tests
    environment: 'node',
    include: [
      'shared/**/*.test.ts',
      'scripts/**/*.test.mts',
      'site/src/**/*.test.{ts,tsx}',
    ],
  },
});
