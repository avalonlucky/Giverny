import type { RefObject } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Archive, KeyRound, LogOut, Settings, UserCircle } from 'lucide-react'
import { appReleaseDate, appVersion } from '../config/appConfig'
import type { AuthRole, StorageUsage, StoredAuth } from '../lib/api'
import type { AppView } from '../types/domain'
import type { SettingsTab } from '../views/SettingsView'

type SidebarNavItem = {
  label: string
  icon: LucideIcon
}

export function AppSidebar({
  activeView,
  backendStatus,
  navItems,
  navShortcutHints,
  navAriaShortcutHints,
  accountMenuRef,
  isAccountMenuOpen,
  auth,
  role,
  isAdmin,
  storageUsage,
  onNavigate,
  onAccountMenuOpenChange,
  onOpenSettings,
  onLogin,
  onSignOut,
}: {
  activeView: AppView
  backendStatus: '连接中' | '已接入 D1/R2' | '后端异常'
  navItems: SidebarNavItem[]
  navShortcutHints: Partial<Record<AppView, string>>
  navAriaShortcutHints: Partial<Record<AppView, string>>
  accountMenuRef: RefObject<HTMLDivElement | null>
  isAccountMenuOpen: boolean
  auth: StoredAuth | null
  role: AuthRole
  isAdmin: boolean
  storageUsage: StorageUsage | null
  onNavigate: (view: AppView) => void
  onAccountMenuOpenChange: (open: boolean | ((current: boolean) => boolean)) => void
  onOpenSettings: (tab: SettingsTab) => void
  onLogin: () => void
  onSignOut: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img className="brand-logo" src="/giverny-logo.png" alt="" />
        </div>
        <div>
          <strong>
            Giverny
            <span className="brand-watermark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M12 8C9 8 6 9 6 12C6 14 8 15 12 15C16 15 18 14 18 12C18 9 15 8 12 8Z" />
                <path d="M12 8C12 6 13 5 14 5" />
                <circle cx="12" cy="11" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </span>
          </strong>
          <span className={`brand-status ${backendStatus === '后端异常' ? 'error' : backendStatus === '已接入 D1/R2' ? 'ok' : 'pending'}`} title={backendStatus}>
            <i aria-hidden="true" />
            让创作在自己的花园里生长
          </span>
        </div>
      </div>

      <nav className="nav-list" aria-label="主导航">
        {navItems.map((item) => {
          const shortcut = navShortcutHints[item.label as AppView]
          const ariaShortcut = navAriaShortcutHints[item.label as AppView]
          const NavIcon = item.icon
          return (
            <div key={item.label}>
              <button
                className={`nav-item ${activeView === item.label ? 'active' : ''}`}
                aria-label={`切换到${item.label}`}
                aria-keyshortcuts={ariaShortcut}
                title={shortcut ? `${item.label}（${shortcut}）` : item.label}
                onClick={() => onNavigate(item.label as AppView)}
              >
                <NavIcon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-account" ref={accountMenuRef}>
        {isAccountMenuOpen && (
          <div className="sidebar-account-menu" role="menu" aria-label="管理员菜单">
            <div className="account-menu-identity">
              <UserCircle size={18} />
              <div>
                <strong>{auth?.email || '游客访问'}</strong>
                <span>{
                  isAdmin ? '最终管理员'
                    : role === 'collaborator' ? '协作者（可录入）'
                    : role === 'viewer' ? '只读全局'
                    : role === 'client' ? '合作伙伴（当月可见）'
                    : auth ? '访问口令（只读）' : '游客只读'
                }</span>
              </div>
            </div>
            {isAdmin ? (
              <>
                <button className="account-menu-item" type="button" role="menuitem" onClick={() => onOpenSettings('settlement')}>
                  <Settings size={17} />
                  <span>全站设置</span>
                </button>
                <div className="account-menu-storage" title={storageUsage ? `Cloudflare R2 文件空间 · ${storageUsage.objectCount} 个对象` : 'Cloudflare R2 文件空间'}>
                  <Archive size={17} />
                  <div>
                    <span>R2 文件空间</span>
                    <strong>{storageUsage?.label ?? '同步中'}</strong>
                  </div>
                </div>
                <button className="account-menu-item danger" type="button" role="menuitem" onClick={onSignOut}>
                  <LogOut size={17} />
                  <span>退出登录</span>
                </button>
              </>
            ) : (
              <>
                <p className="account-menu-note">当前只能查看公开任务、进展和合作伙伴可见文件；编辑、上传、验收和结算需要管理员身份。</p>
                <button className="account-menu-item" type="button" role="menuitem" onClick={() => { onAccountMenuOpenChange(false); onLogin() }}>
                  <KeyRound size={17} />
                  <span>登录管理员</span>
                </button>
                {auth && (
                  <button className="account-menu-item danger" type="button" role="menuitem" onClick={onSignOut}>
                    <LogOut size={17} />
                    <span>退出访问口令</span>
                  </button>
                )}
              </>
            )}
            <div className="account-menu-version" title={`发布于 ${appReleaseDate}`}>v{appVersion}</div>
          </div>
        )}
        <button
          className={`sidebar-account-trigger ${isAccountMenuOpen || activeView === '设置' ? 'active' : ''}`}
          type="button"
          title="设置（,）"
          aria-keyshortcuts=","
          onClick={() => {
            if (activeView === '设置') {
              onAccountMenuOpenChange((value) => !value)
              return
            }
            onAccountMenuOpenChange(false)
            onOpenSettings('ai')
          }}
        >
          <Settings size={17} aria-hidden="true" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  )
}
