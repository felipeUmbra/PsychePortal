import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Conditionally import visualizer only when analyzing
let visualizer: any = null;
if (process.env.ANALYZE_BUNDLE) {
  try {
    visualizer = require('rollup-plugin-visualizer').visualizer;
  } catch (e) {
    console.warn('rollup-plugin-visualizer not installed');
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/PsychePortal/', // Adicione esta linha (O nome exato do seu repositório no GitHub)
    plugins: [
      // PWA support with auto-update
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        includeAssets: ['logo.png'],
        manifest: {
          name: 'PsychePortal',
          short_name: 'PsychePortal',
          description: 'A secure, clinical-grade workspace for mental health professionals.',
          theme_color: '#4338CA',
          background_color: '#F4F6F9',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      }),
      react(),
      tailwindcss(),
      // Add visualizer in analyze mode
      ...(visualizer ? [visualizer({ open: true, gzipSize: true })] : [])
    ],
    define: {},
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'firebase/firestore': path.resolve(__dirname, './src/lib/firestore-mock.ts')
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
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
