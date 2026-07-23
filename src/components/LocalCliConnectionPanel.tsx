import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Bot, CheckCircle2, Copy, RotateCcw, Search } from 'lucide-react'
import { api, type LocalCliDevice } from '../lib/api'
import { LOCAL_CLI_RUNTIME_VERSION, localCliBrowserDeviceKey, localCliRuntimeReady } from '../lib/localCli'

export default function LocalCliConnectionPanel({ renderCliIcon }: { renderCliIcon: (cliId: string) => ReactNode }) {
  const [browserDeviceKey] = useState(localCliBrowserDeviceKey)
  const [devices, setDevices] = useState<LocalCliDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string; bridgeUrl: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [installTarget, setInstallTarget] = useState<'unix' | 'windows'>(() => /Windows/i.test(window.navigator.userAgent) ? 'windows' : 'unix')

  const loadDevices = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const result = await api.getLocalCliDevices(browserDeviceKey)
      setDevices(result.devices)
      setError('')
      if (result.devices.length > 0) setPairing(null)
    } catch (reason) {
      if (!quiet) setError(reason instanceof Error ? reason.message : '读取本机 CLI 状态失败')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [browserDeviceKey])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadDevices(), 0)
    const timer = window.setInterval(() => void loadDevices(true), 8_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [loadDevices])

  const startPairing = async () => {
    setBusy('pair')
    setError('')
    try {
      setPairing(await api.createLocalCliPairing(browserDeviceKey))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建配对码失败')
    } finally {
      setBusy('')
    }
  }

  const installCommand = pairing
    ? installTarget === 'windows'
      ? `$dir = Join-Path $HOME '.giverny'; New-Item -ItemType Directory -Force -Path $dir | Out-Null; Invoke-WebRequest -Uri '${pairing.bridgeUrl}' -OutFile (Join-Path $dir 'bridge.mjs'); node (Join-Path $dir 'bridge.mjs') pair ${pairing.code} --server ${window.location.origin}; node (Join-Path $dir 'bridge.mjs') start`
      : `mkdir -p ~/.giverny && curl -fsSL ${pairing.bridgeUrl} -o ~/.giverny/bridge.mjs && node ~/.giverny/bridge.mjs pair ${pairing.code} --server ${window.location.origin} && node ~/.giverny/bridge.mjs start`
    : ''

  const copyInstallCommand = async () => {
    if (!installCommand) return
    await navigator.clipboard.writeText(installCommand)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const waitForCommand = async (commandId: string) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 900))
      const result = await api.getLocalCliCommand(commandId)
      if (result.status === 'completed') return
      if (result.status === 'failed' || result.status === 'expired') throw new Error(result.error || '扫描未完成，请确认 Bridge 仍在运行')
    }
    throw new Error('扫描超时，请确认本机 Bridge 仍在运行')
  }

  const scanDevice = async (device: LocalCliDevice) => {
    setBusy(`scan:${device.id}`)
    setError('')
    try {
      const queued = await api.scanLocalCliDevice(device.id)
      await waitForCommand(queued.commandId)
      await loadDevices(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CLI 扫描失败')
    } finally {
      setBusy('')
    }
  }

  const selectCli = async (device: LocalCliDevice, cliId: string) => {
    setBusy(`select:${device.id}:${cliId}`)
    setError('')
    try {
      const result = await api.selectLocalCliAdapter(device.id, cliId)
      setDevices((current) => current.map((item) => item.id === result.device.id ? result.device : item))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CLI 连接失败')
    } finally {
      setBusy('')
    }
  }

  const statusLabel = (status: LocalCliDevice['clis'][number]['status']) => {
    if (status === 'available') return '可用'
    if (status === 'needs_auth') return '需要登录'
    if (status === 'unsupported') return '待适配'
    if (status === 'not_installed') return '未安装'
    return '不可用'
  }

  return (
    <div className="settings-group-body settings-tab-body">
      <section className="panel local-cli-panel">
        <div className="panel-header compact local-cli-panel-header">
          <div>
            <h2>本机 CLI 连接</h2>
            <p>识别当前网页登录电脑上的 Agent CLI；设备按登录账号隔离，不会把合作伙伴的命令发送到其他人的电脑。</p>
          </div>
          <div className="local-cli-header-actions">
            <a className="ghost-button compact-button" href="/giverny-bridge.mjs" download>下载连接器</a>
            {devices.length === 0 ? (
              <button type="button" className="soft-primary-button compact-button" onClick={() => void startPairing()} disabled={busy === 'pair'}>
                <Search size={14} />
                {busy === 'pair' ? '准备中…' : '扫描这台电脑'}
              </button>
            ) : (
              <button type="button" className="soft-primary-button compact-button" onClick={() => void scanDevice(devices[0])} disabled={!devices[0].online || busy.startsWith('scan:')}>
                <RotateCcw size={14} />
                {busy.startsWith('scan:') ? '测试中…' : '测试并重新扫描'}
              </button>
            )}
          </div>
        </div>

        {error && <p className="settings-inline-error local-cli-error">{error}</p>}
        {loading && <p className="calendar-empty-hint">正在读取本机连接状态…</p>}

        {!loading && devices.length === 0 && !pairing && (
          <div className="local-cli-empty">
            <Bot size={25} />
            <strong>尚未连接这台电脑</strong>
            <p>点击「扫描这台电脑」生成一次性配对码。连接器只向 Giverny 发起出站请求，不开放本机端口。</p>
          </div>
        )}

        {pairing && (
          <div className="local-cli-pairing">
            <div className="local-cli-pairing-code">
              <span>10 分钟一次性配对码</span>
              <strong>{pairing.code.slice(0, 4)} {pairing.code.slice(4)}</strong>
              <small>过期时间：{new Date(pairing.expiresAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
            <div className="local-cli-pairing-command">
              <div className="local-cli-install-target">
                <span>在当前电脑的终端运行</span>
                <div role="group" aria-label="选择电脑系统">
                  <button type="button" className={installTarget === 'unix' ? 'active' : ''} onClick={() => setInstallTarget('unix')}>macOS / Linux</button>
                  <button type="button" className={installTarget === 'windows' ? 'active' : ''} onClick={() => setInstallTarget('windows')}>Windows</button>
                </div>
              </div>
              <code>{installCommand}</code>
              <button type="button" className="ghost-button compact-button" onClick={() => void copyInstallCommand()}>
                <Copy size={14} /> {copied ? '已复制' : '复制命令'}
              </button>
            </div>
            <p>命令运行后，本页会自动识别当前浏览器对应的电脑。关闭终端会离线；后续将提供系统开机自启安装器。</p>
          </div>
        )}

        {devices.map((device) => (
          <article className="local-cli-device" key={device.id}>
            <header>
              <div>
                <span className={`local-cli-online-dot ${device.online ? 'online' : ''}`} />
                <strong>{device.name}</strong>
                <small>{device.platform} · {device.arch} · Bridge {device.bridgeVersion || '未知版本'}</small>
              </div>
              <em className={device.online ? 'online' : ''}>{device.online ? 'Bridge 已在线' : 'Bridge 已离线'}</em>
            </header>
            {device.online && !localCliRuntimeReady(device.bridgeVersion) && (
              <p className="settings-inline-error local-cli-error">连接器版本过旧。请重新下载并启动 Bridge {LOCAL_CLI_RUNTIME_VERSION}，否则工作助手会继续回退云端。</p>
            )}
            <div className="local-cli-list">
              {device.clis.map((cli) => {
                const runtimeReady = localCliRuntimeReady(device.bridgeVersion)
                const connected = device.online && runtimeReady && cli.selected
                const selectedNeedsUpdate = device.online && cli.selected && !runtimeReady
                const selectable = device.online && runtimeReady && cli.status === 'available'
                return (
                  <div className={`local-cli-row ${connected ? 'connected' : ''}`} key={cli.id}>
                    <div className="local-cli-row-icon">{renderCliIcon(cli.id)}</div>
                    <div className="local-cli-row-main">
                      <strong>{cli.name}</strong>
                      <span>{cli.version || cli.detail}</span>
                      {cli.version && <small>{cli.detail}</small>}
                    </div>
                    <div className="local-cli-row-capabilities">
                      {cli.supportsStreaming && <span>流式步骤</span>}
                      {cli.supportsMcp && <span>MCP</span>}
                    </div>
                    <div className="local-cli-row-status">
                      <em className={`status-${cli.status}`}>{connected ? '已连接并用于工作助手' : selectedNeedsUpdate ? '需更新 Bridge' : statusLabel(cli.status)}</em>
                      <button
                        type="button"
                        className={connected ? 'ghost-button compact-button' : 'primary-button compact-button'}
                        disabled={!selectable || connected || selectedNeedsUpdate || busy.startsWith('select:')}
                        onClick={() => void selectCli(device, cli.id)}
                      >
                        {connected ? <><CheckCircle2 size={14} /> 已连接</> : selectedNeedsUpdate ? '需更新' : '连接'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        ))}
        <p className="settings-tool-note local-cli-note">连接后，工作助手的普通问答、站内只读查询和本机文件任务会优先使用当前电脑的 CLI；创建、修改、记录进展和验收等站内写入仍交给云端 Agent 生成确认草稿。本机离线、超时或执行失败时会自动回退云端。</p>
      </section>
    </div>
  )
}
