import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Pin large vendor deps to their own long-cached chunks so app code
        // changes don't bust the React bundle in the browser cache.
        manualChunks: {
          react: ['react', 'react-dom'],
          axios: ['axios'],
        },
      },
    },
  },
  esbuild: {
    // strip console + debugger calls from production bundle
    drop: ['console', 'debugger'],
  },
})
