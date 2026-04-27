import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

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
