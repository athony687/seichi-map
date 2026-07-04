import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // ESM版(.mjs)が循環参照でTDZを引き起こすため、UMD版を使用する
    alias: {
      '@vis.gl/react-google-maps': path.resolve(
        './node_modules/@vis.gl/react-google-maps/dist/index.umd.js'
      ),
    },
  },
})
