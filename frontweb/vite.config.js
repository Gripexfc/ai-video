import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3013,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5679',
        changeOrigin: true
      },
      '/static': {
        target: 'http://127.0.0.1:5679',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', 'axios', 'element-plus', '@element-plus/icons-vue']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
          'axios': ['axios'],
        }
      }
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    target: 'es2020',
    minify: 'esbuild',
  }
})
