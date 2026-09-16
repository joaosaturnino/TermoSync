import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isCapacitorBuild = process.env.VITE_CAPACITOR === 'true'

export default defineConfig({
  plugins: [react()],
  base: isCapacitorBuild ? './' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('dompurify')) return 'vendor-documents';
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'vendor-realtime';
          if (id.includes('axios')) return 'vendor-http';
          if (id.includes('lucide-react')) return 'vendor-icons';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
