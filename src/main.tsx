import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { installGlobalErrorReporting } from './lib/clientErrorReporter'
import { installClientPerformanceReporting } from './lib/clientPerformanceReporter'
import { router } from './router'

installGlobalErrorReporting()
installClientPerformanceReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </StrictMode>,
)
