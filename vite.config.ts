import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base =
    env.VITE_BASE_PATH ||
    (process.env.VITE_BASE_PATH as string | undefined) ||
    '/personal_website/';

  return {
    base,
    root: '.',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          profile: resolve(__dirname, 'profile/index.html'),
          raycaster: resolve(__dirname, 'projects/raycaster/index.html'),
          cuhkszCalendarSync: resolve(__dirname, 'projects/cuhksz-calendar-sync/index.html'),
        },
      },
    },
    server: {
      port: 5173,
    },
  };
});
