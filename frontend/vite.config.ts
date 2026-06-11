import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

declare const process: {
  cwd: () => string;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/caudalia/',
    plugins: [react()],
    server: {
      port: 5174,
    },
  };
});
