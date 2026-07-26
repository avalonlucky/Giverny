import { Navigate, createBrowserRouter } from 'react-router'
import type { AppRouteHandle } from './lib/appRoutes'

const adminRoutes: Array<{ path: string; handle: AppRouteHandle }> = [
  { path: '/dashboard', handle: { appView: '工作台' } },
  { path: '/tasks', handle: { appView: '任务' } },
  { path: '/files', handle: { appView: '文件库' } },
  { path: '/insights', handle: { appView: '洞察' } },
  { path: '/income', handle: { appView: '收入' } },
  { path: '/reports', handle: { appView: '结算' } },
  { path: '/settings', handle: { appView: '设置' } },
  { path: '/knowledge', handle: { appView: '知识库' } },
]

export const router = createBrowserRouter([
  {
    path: '/share/:token',
    lazy: () => import('./routes/SharedReportRoute'),
  },
  {
    path: '/settlement-share/:token',
    lazy: () => import('./routes/SharedSettlementRoute'),
  },
  ...adminRoutes.map((route) => ({
    ...route,
    lazy: () => import('./routes/AdminRoute'),
  })),
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '/updates',
    element: <Navigate to="/tasks" replace />,
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
