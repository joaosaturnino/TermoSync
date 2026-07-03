import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isCapacitorBuild = process.env.VITE_CAPACITOR === 'true'

export default defineConfig({
  plugins: [react()],
  base: isCapacitorBuild ? './' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
  },
})
