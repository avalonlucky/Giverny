import { readFileSync } from 'node:fs'
import process from 'node:process'

const mainSource = readFileSync('src/main.tsx', 'utf8')
const appSource = readFileSync('src/App.tsx', 'utf8')
const routerSource = readFileSync('src/router.tsx', 'utf8')
const failures = []

if (!routerSource.includes('createBrowserRouter')) failures.push('src/router.tsx 未使用 createBrowserRouter')
if (!mainSource.includes('<RouterProvider')) failures.push('src/main.tsx 未使用 RouterProvider')
if (/window\.location\.pathname|<BrowserRouter/.test(mainSource)) failures.push('src/main.tsx 重新引入手写路径分流')
if (/from ['"]\.\/Shared(?:Report|SettlementExport)/.test(mainSource)) failures.push('公开分享页被入口同步导入')
if (/\bviewFromPath\b|\brouteViews\b/.test(appSource)) failures.push('src/App.tsx 重新引入 URL 到视图的手写映射')
if (!routerSource.includes("lazy: () => import('./routes/SharedReportRoute')")) failures.push('普通分享页未按路由懒加载')
if (!routerSource.includes("lazy: () => import('./routes/SharedSettlementRoute')")) failures.push('结算分享页未按路由懒加载')

if (failures.length > 0) {
  console.error(`路由架构守卫失败：\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('路由架构守卫通过：正式路由树、公开页懒加载和单一 RouterProvider 均已启用。')
