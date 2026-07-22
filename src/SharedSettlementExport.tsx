import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
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
          <a className="primary-button" href={`/api/shared-settlement/${encodeURIComponent(token)}/excel`}>
            <Download size={17} />下载 Excel 回单
          </a>
        </header>
        <SettlementReceipt options={state.receipt} className="shared-settlement-receipt" />
        <SharedProjectAppendix tasks={state.tasks} updates={state.updates} files={state.files} />
      </div>
    </main>
  )
}
