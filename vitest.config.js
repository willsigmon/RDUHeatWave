import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment-id/exec',
    },
  },
});
