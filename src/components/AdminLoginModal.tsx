import { useEffect, useRef, useState } from 'react'
import { Lock, Mail, X } from 'lucide-react'
import { loadTurnstileScript } from '../lib/turnstile'
import { ModalShell } from './ModalShell'

// Cloudflare Turnstile 站点密钥（公开，可放前端）；密钥(secret)只在 Worker 后端环境变量里。
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAADq6J7chw6N3buxI'

function isLocalPreviewHost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

export function AdminLoginModal({
  error,
  onClose,
  onSubmit,
}: {
  error: string
  onClose: () => void
  onSubmit: (email: string, key: string, turnstileToken?: string) => void
}) {
  const [email, setEmail] = useState('')
  const [key, setKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const isLocalPreview = isLocalPreviewHost()

  // 渲染 Cloudflare Turnstile 人机验证小组件，拿到 token 后才允许登录
  useEffect(() => {
    if (isLocalPreview) {
      return
    }
    let cancelled = false
    const renderWidget = () => {
      const ts = (window as unknown as { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id: string) => void } }).turnstile
      if (cancelled || !ts || !turnstileRef.current || turnstileWidgetId.current) {
        return
      }
      turnstileWidgetId.current = ts.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'error-callback': () => setTurnstileToken(''),
        'expired-callback': () => setTurnstileToken(''),
      })
    }
    if ((window as unknown as { turnstile?: unknown }).turnstile) {
      renderWidget()
    } else {
      void loadTurnstileScript()
        .then(renderWidget)
        .catch(() => {
          if (!cancelled) {
            setTurnstileToken('')
          }
        })
    }
    return () => { cancelled = true }
  }, [isLocalPreview])

  const submit = async () => {
    if (!key.trim() || isSubmitting) {
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(email.trim(), key.trim(), turnstileToken)
      // 重置验证码：token 一次性，失败重试需要新 token（成功则弹窗已关闭，无影响）
      const ts = (window as unknown as { turnstile?: { reset: (id: string) => void } }).turnstile
      if (ts && turnstileWidgetId.current) {
        ts.reset(turnstileWidgetId.current)
        setTurnstileToken('')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell className="admin-login-modal" labelledBy="admin-login-title" onClose={onClose}>
      <div className="login-atmosphere">
        <div className="login-pond" aria-hidden="true" />
        <button className="icon-button modal-close-button login-close" aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="login-wordmark">
          <img className="brand-logo" src="/giverny-logo.png" alt="" />
          <strong>Giverny</strong>
          <span>让创作在自己的花园里生长</span>
        </div>
      </div>
      <header className="modal-header login-functional-header">
        <div>
          <h2 id="admin-login-title">登录后才能编辑</h2>
          <small>游客可直接浏览；新建、修改、上传、验收和结算需要管理员身份。</small>
        </div>
      </header>
      <div className="admin-login-body">
        <label className="lock-input">
          <Mail size={17} />
          <input value={email} placeholder="管理员邮箱（访问口令登录可留空）" onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="lock-input">
          <Lock size={17} />
          <input
            type="password"
            value={key}
            placeholder="管理密码或访问口令"
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submit()
              }
            }}
          />
        </label>
        {isLocalPreview ? (
          <p className="login-local-preview">本地预览模式，无需人机验证</p>
        ) : (
          <div ref={turnstileRef} className="login-turnstile" />
        )}
        {error && <p className="lock-error">{error}</p>}
      </div>
      <footer className="modal-footer">
        <button className="ghost-button" onClick={onClose}>取消</button>
        <button
          className="primary-button"
          onClick={() => void submit()}
          disabled={!key.trim() || (!isLocalPreview && !turnstileToken) || isSubmitting}
          title={!isLocalPreview && !turnstileToken ? '请先完成人机验证' : undefined}
        >
          {isSubmitting ? '正在进入…' : '进入工作台'}
        </button>
      </footer>
    </ModalShell>
  )
}
