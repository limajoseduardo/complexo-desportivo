import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: env.VITE_BASE_URL || '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
              handler: 'NetworkFirst',
              options: { cacheName: 'firestore-cache' }
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/firebase/auth')) return 'firebase-auth';
            if (id.includes('node_modules/firebase/firestore')) return 'firebase-firestore';
            if (id.includes('node_modules/firebase/app')) return 'firebase-app';
            if (id.includes('node_modules/firebase/')) return 'firebase-misc';
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor';
            if (id.includes('node_modules/recharts')) return 'charts';
            if (id.includes('node_modules/jspdf')) return 'pdf';
            if (id.includes('node_modules/motion')) return 'motion';
            if (id.includes('node_modules/lucide-react')) return 'lucide';
          },
        },
      },
    },
    server: {
      port: 3100,
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true'
        ? { host: '192.168.1.130', port: 3100 }
        : false,
    },
  };
});
