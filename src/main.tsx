import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SharedReport from './SharedReport.tsx'

const shareMatch = window.location.pathname.match(/^\/share\/([\w-]+)/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{shareMatch ? <SharedReport token={shareMatch[1]} /> : <App />}</StrictMode>,
)
