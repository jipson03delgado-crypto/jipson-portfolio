import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ocr: resolve(__dirname, 'ocr-excel/index.html'),
      },
    },
  },
})
