import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true, // 如果端口被占用则报错，而不是自动切换
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Prevent proxy timeouts for large file uploads on slow connections
        timeout: 0,           // No timeout on proxy connection
        proxyTimeout: 0,      // No timeout waiting for target response
        configure: (proxy) => {
          // Increase max header size and disable buffering for streaming uploads
          proxy.on('proxyReq', (proxyReq) => {
            // Remove any content-length limits set by default
            proxyReq.setHeader('Connection', 'keep-alive');
          });
        }
      }
    }
  }
})