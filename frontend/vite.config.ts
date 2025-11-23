import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'rxdb/plugins/dexie': fileURLToPath(new URL('./node_modules/rxdb/plugins/storage-dexie/index.mjs', import.meta.url))
    }
  },
  optimizeDeps: {
    include: [
      'rxdb',
      'rxdb/plugins/dexie',
      'rxdb/plugins/validate-ajv',
      'rxjs',
    ]
  },
  build: {
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger']
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  }
})


