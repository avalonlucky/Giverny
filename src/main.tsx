import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SharedReport from './SharedReport.tsx'
import SharedSettlementExport from './SharedSettlementExport.tsx'

const shareMatch = window.location.pathname.match(/^\/share\/([\w-]+)/)
const settlementShareMatch = window.location.pathname.match(/^\/settlement-share\/([\w-]+)/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{settlementShareMatch ? <SharedSettlementExport token={settlementShareMatch[1]} /> : shareMatch ? <SharedReport token={shareMatch[1]} /> : <App />}</StrictMode>,
)
