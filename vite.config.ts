import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icone-192.png', 'icone-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        // O plano seed é grande (~170kb) e precisa estar no cache offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'Time Híbrido Tracker',
        short_name: 'Time Híbrido',
        description: 'Acompanhamento do programa híbrido de 12 semanas: corrida 3km + musculação.',
        lang: 'pt-BR',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-512-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // O plano seed (~170kb) muda pouco: em chunk próprio, o cache do
        // service worker não precisa rebaixá-lo a cada mudança de código.
        manualChunks: {
          plano: ['./src/dados/plano_time_hibrido.json'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'dexie'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
