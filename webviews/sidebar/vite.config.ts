import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import dotenv from 'dotenv';

// Load root .env manually (one directory up)
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files that Vite would normally load (e.g., .env.development)
  const viteEnv = loadEnv(mode, process.cwd(), '');

  // Merge all envs: system + root .env + viteEnv
  const mergedEnv = {
    ...process.env,
    ...viteEnv,
  };

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    define: {
      // ✅ Ensure all env vars are inlined for use in client-side code
      'process.env': mergedEnv,
    },

    build: {
      outDir: 'build',
      minify: 'esbuild',
      target: 'es2018',
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].js`,
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
    },
  };
});
