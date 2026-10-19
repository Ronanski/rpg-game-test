import { defineConfig } from 'vite';

// Relative base so the same build works on GitHub Pages (/repo-name/) and inside the Capacitor APK.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
