import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { ToastTone } from '../lib/toastQueue'

export function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'error') return <AlertTriangle size={17} />
  if (tone === 'info') return <Info size={17} />
  return <CheckCircle2 size={17} />
}
