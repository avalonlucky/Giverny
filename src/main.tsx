import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import SharedReport from './SharedReport.tsx'
import SharedSettlementExport from './SharedSettlementExport.tsx'
import { installGlobalErrorReporting } from './lib/clientErrorReporter'

installGlobalErrorReporting()

const shareMatch = window.location.pathname.match(/^\/share\/([\w-]+)/)
const settlementShareMatch = window.location.pathname.match(/^\/settlement-share\/([\w-]+)/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {settlementShareMatch ? (
        <SharedSettlementExport token={settlementShareMatch[1]} />
      ) : shareMatch ? (
        <SharedReport token={shareMatch[1]} />
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </AppErrorBoundary>
  </StrictMode>,
)
