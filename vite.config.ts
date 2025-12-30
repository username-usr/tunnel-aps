import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // This allows external network access
    port: 5173,
    strictPort: false,
    // Enable HTTPS for better P2P connections (optional but recommended)
    // https: true,
    hmr: {
      host: 'localhost', // or your local IP
    },
    // Allow all origins for development
    cors: true,
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'peerjs': ['peerjs'],
          'dexie': ['dexie'],
        },
      },
    },
  }
})
