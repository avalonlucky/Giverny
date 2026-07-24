import { useParams } from 'react-router'
import SharedSettlementExport from '../SharedSettlementExport'

export function Component() {
  const { token = '' } = useParams()
  return <SharedSettlementExport token={token} />
}
