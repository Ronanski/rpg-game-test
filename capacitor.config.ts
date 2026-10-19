import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.ronanski.echoes',
  appName: 'Aethelgard: Chronos of Fate',
  webDir: 'dist',
  plugins: {
    // In-app updates: the game downloads new versions from GitHub Pages itself (see src/core/Updater.ts).
    CapacitorUpdater: { autoUpdate: false },
  },
};

export default config;
