import { defineConfig } from 'vite';

// Relative base so the same build works on GitHub Pages (/repo-name/) and inside the Capacitor APK.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  // Which build this is; the app compares it with the one online to know when to update.
  define: { __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || 'dev') },
});
