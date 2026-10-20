import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

// Relative base so the same build works on GitHub Pages (/repo-name/) and inside the Capacitor APK.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  // Which build this is; the app compares it with the one online to know when to update.
  // The version (package.json) is shown on the title screen ("BETA 0.4.0-beta.1").
  define: { __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || 'dev'), __APP_VERSION__: JSON.stringify(pkg.version) },
});
