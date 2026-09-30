import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const isCapacitorBuild = process.env.VITE_CAPACITOR === 'true'
const certificatePath = fileURLToPath(new URL('./.cert/thermosync.pfx', import.meta.url))
const certificatePasswordPath = fileURLToPath(new URL('./.cert/passphrase', import.meta.url))
const hasLocalCertificate = existsSync(certificatePath) && existsSync(certificatePasswordPath)
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export default defineConfig(({ command }) => {
  if (command === 'serve' && !hasLocalCertificate) {
    throw new Error('Certificado HTTPS ausente. Execute "npm run setup:local-domain" na raiz do projeto.')
  }

  const https = hasLocalCertificate
    ? {
        pfx: readFileSync(certificatePath),
        passphrase: readFileSync(certificatePasswordPath, 'utf8').trim(),
      }
    : undefined

  return {
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
    port: 443,
    strictPort: true,
    https,
    headers: securityHeaders,
    allowedHosts: ['thermosync.com.br'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 443,
    strictPort: true,
    https,
    headers: securityHeaders,
    allowedHosts: ['thermosync.com.br'],
  },
  }
})
