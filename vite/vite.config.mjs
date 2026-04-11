import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const BASE = env.VITE_APP_BASE_NAME || '/';
  const PORT = 3000;

  // During `vite dev` we proxy /api to a locally-running worker so the
  // frontend can use same-origin requests in both dev and production.
  const WORKER_URL = env.VITE_WORKER_URL || 'http://localhost:8787';

  return {
    server: {
      open: true,
      port: PORT,
      host: true,
      proxy: {
        '/api': {
          target: WORKER_URL,
          changeOrigin: true
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 1600
    },
    preview: {
      open: true,
      host: true,
      proxy: {
        '/api': {
          target: WORKER_URL,
          changeOrigin: true
        }
      }
    },
    define: {
      global: 'window'
    },
    resolve: {
      alias: {
        '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs'
      }
    },
    base: BASE,
    plugins: [react(), jsconfigPaths()]
  };
});
