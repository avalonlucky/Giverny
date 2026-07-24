import { useParams } from 'react-router'
import SharedReport from '../SharedReport'

export function Component() {
  const { token = '' } = useParams()
  return <SharedReport token={token} />
}
