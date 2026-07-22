import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { api, type SharedSettlementExportState } from './lib/api'
import { SettlementReceipt } from './components/SettlementReceipt'
import { SharedProjectAppendix } from './components/SharedProjectAppendix'
import './App.css'

export default function SharedSettlementExport({ token }: { token: string }) {
  const [state, setState] = useState<SharedSettlementExportState | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getSharedSettlementExport(token)
      .then(setState)
      .catch((cause) => setError(cause instanceof Error ? cause.message : '加载失败'))
  }, [token])

  if (error) {
    return <main className="shared-page"><div className="shared-message panel"><strong>无法打开该回单</strong><p>{error}</p></div></main>
  }
  if (!state) {
    return <main className="shared-page"><div className="shared-message panel"><strong>正在加载回单…</strong></div></main>
  }

  return (
    <main className="shared-page">
      <div className="shared-content shared-receipt-view">
        <header className="shared-receipt-toolbar">
          <div>
            <h1>结算回单</h1>
            <p>{state.receipt.settlementLabel} · 在线只读预览</p>
          </div>
          <div className="shared-receipt-actions">
            <a className="icon-button" href={`/api/shared-settlement/${encodeURIComponent(token)}/excel`} aria-label="下载 Excel" title="下载 Excel">
              <Download size={17} />
            </a>
            <a className="icon-button" href={`/api/shared-settlement/${encodeURIComponent(token)}/pdf`} aria-label="下载 PDF" title="下载 PDF">
              <FileText size={17} />
            </a>
          </div>
        </header>
        <SettlementReceipt options={state.receipt} className="shared-settlement-receipt" />
        <SharedProjectAppendix tasks={state.tasks} updates={state.updates} files={state.files} />
      </div>
    </main>
  )
}
