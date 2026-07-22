import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Giverny] render failed', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-boundary" role="alert">
          <section>
            <span>Giverny</span>
            <h1>页面暂时没有正常显示</h1>
            <p>这通常是某个局部组件渲染失败。刷新后会重新加载最新数据；如果仍然出现，请保留当前操作截图。</p>
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              重新加载
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
