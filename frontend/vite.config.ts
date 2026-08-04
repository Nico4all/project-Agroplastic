import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

declare const process: {
  cwd: () => string;
};

export default defineConfig(({ mode }) => {
  const envDir = `${process.cwd()}/..`;
  const env = loadEnv(mode, envDir, 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/caja-bodega/',
    envDir,
    plugins: [react()],
    server: {
      port: 3003,
    },
  };
});
