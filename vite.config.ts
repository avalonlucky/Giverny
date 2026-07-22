import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor'
          if (id.includes('/node_modules/react-markdown/') || id.includes('/node_modules/remark-gfm/')) return 'markdown'
          if (id.includes('/node_modules/lucide-react/')) return 'icons'
          if (id.includes('/node_modules/pdfjs-dist/')) return 'pdf'
          if (id.includes('/node_modules/exceljs/')) return 'excel'
          if (id.includes('/node_modules/html2canvas/')) return 'canvas'
          if (id.includes('/node_modules/ag-psd/')) return 'psd'
          if (id.includes('/node_modules/docx-preview/')) return 'docx-preview'
          return undefined
        },
      },
    },
  },
})
