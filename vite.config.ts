import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](?:react|react-dom)[\\/]/ },
            { name: 'markdown', test: /node_modules[\\/](?:react-markdown|remark-gfm)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'pdf-worker', test: /node_modules[\\/]pdfjs-dist[\\/]build[\\/]pdf\.worker/ },
            { name: 'pdf', test: /node_modules[\\/]pdfjs-dist[\\/]/ },
            { name: 'excel', test: /node_modules[\\/]exceljs[\\/]/ },
            { name: 'canvas', test: /node_modules[\\/]html2canvas[\\/]/ },
            { name: 'psd', test: /node_modules[\\/]ag-psd[\\/]/ },
            { name: 'docx-preview', test: /node_modules[\\/]docx-preview[\\/]/ },
            { name: 'pptx-preview', test: /node_modules[\\/]pptx-preview[\\/]/ },
            { name: 'archive', test: /node_modules[\\/]jszip[\\/]/ },
          ],
        },
      },
    },
  },
})
