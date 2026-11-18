import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Size of the rep-app APK shown next to the download buttons.
function apkSize(): string {
  try {
    const bytes = statSync(fileURLToPath(new URL('./public/downloads/nms-sales-rep.apk', import.meta.url))).size
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  } catch { return 'APK' }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: { __REP_APK_SIZE__: JSON.stringify(apkSize()) },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN', // the rep-app preview is iframed from /rep-app/
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    minify: 'esbuild',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Pin large vendor deps to their own long-cached chunks so app code
        // changes don't bust the React bundle in the browser cache.
        manualChunks: {
          react: ['react', 'react-dom'],
          axios: ['axios'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
  esbuild: {
    // strip console + debugger calls from production bundle
    drop: ['console', 'debugger'],
    legalComments: 'none',
  },
})
