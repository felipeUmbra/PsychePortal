import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        includeAssets: ['logo.png'],
        manifest: {
          name: 'Portal Psis',
          short_name: 'Portal Psis',
          description: 'A secure, clinical-grade workspace for mental health professionals.',
          theme_color: '#4338CA',
          background_color: '#F4F6F9',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: '/logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      }),
      react(),
      tailwindcss(),
    ],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'firebase/firestore': path.resolve(__dirname, './src/lib/firestore-mock.ts')
      },
    },
    optimizeDeps: {
      exclude: ['firebase/firestore']
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      },
      hmr: false,
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      sourcemap: false,
      rollupOptions: {
        output: {
          // Improved chunking strategy for better caching
          manualChunks: {
            // React core
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // Firebase (loaded early for auth)
            'vendor-firebase': ['firebase/app', 'firebase/auth'],
            // UI libraries (loaded as needed)
            'vendor-ui-react': ['lucide-react'],
            'vendor-motion': ['motion'],
            'vendor-recharts': ['recharts'],
            // Date libraries
            'vendor-date': ['date-fns'],
            // Editor libraries (lazy loaded)
            'vendor-editor': ['@uiw/react-md-editor', 'react-markdown', 'rehype-sanitize'],
          },
          // Add chunk file naming for better caching
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
        },
      },
      // Enable gzip compression in build
      reportCompressedSize: true,
    },
  };
});