import type { ReactElement } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Box, Button, Divider, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, clearTokens, getAccessToken } from './api/client'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ContractsPage } from './pages/ContractsPage'
import { DesignPage } from './pages/DesignPage'
import { DesignChangeOrdersPage } from './pages/DesignChangeOrdersPage'
import { CreateChangeOrderPage } from './pages/CreateChangeOrderPage'
import { QsPage } from './pages/QsPage'
import { AdminProjectsPage } from './pages/admin/AdminProjectsPage'
import { AdminProjectLayout } from './pages/admin/AdminProjectLayout'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminApprovalsPage } from './pages/admin/AdminApprovalsPage'
import { AdminProjectOverviewTab } from './pages/admin/tabs/AdminProjectOverviewTab'
import { AdminProjectAnalyticsTab } from './pages/admin/tabs/AdminProjectAnalyticsTab'
import { AdminProjectChangeOrdersTab } from './pages/admin/tabs/AdminProjectChangeOrdersTab'
import { AdminProjectVariationsTab } from './pages/admin/tabs/AdminProjectVariationsTab'
import { AdminProjectApprovalsTab } from './pages/admin/tabs/AdminProjectApprovalsTab'
import { AdminProjectNotificationsTab } from './pages/admin/tabs/AdminProjectNotificationsTab'
import { AdminProjectLogsTab } from './pages/admin/tabs/AdminProjectLogsTab'
import { AdminProjectStubTab } from './pages/admin/tabs/AdminProjectStubTab'
import { BoqLinesPage } from './pages/BoqLinesPage'
import { ApprovedBoqsPage } from './pages/ApprovedBoqsPage'
import type { DepartmentRole, Me } from './types'

function useAuth() {
  const token = getAccessToken()
  const q = useQuery({
    queryKey: ['me', token],
    queryFn: () => api<Me>('/auth/me'),
    enabled: !!token,
    retry: false,
  })
  return { token, me: q.data, loading: q.isLoading && !!token }
}

function ProtectedLayout() {
  const { token, me, loading } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  const hasDesignAccess = !!me?.memberships.some((m) => m.role === 'design' || m.role === 'admin')
  const hasApprovedBoqAccess =
    !!me?.user.is_superuser ||
    !!me?.memberships.some(
      (m) => m.role === 'contracts' || m.role === 'design' || m.role === 'admin',
    )

  if (!token) return <Navigate to="/login" replace />
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    )
  }
  if (!me) {
    clearTokens()
    return <Navigate to="/login" replace />
  }

  function dashboardPath(projectId: string, role: DepartmentRole): string {
    if (role === 'design') return `/design/${projectId}`
    if (role === 'qs') return `/qs/${projectId}`
    return `/contracts/${projectId}`
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { label: 'Projects', path: '/projects', show: true },
    { label: "Approved BOQ's", path: '/approved-boqs', show: hasApprovedBoqAccess },
    { label: 'Design Change Orders', path: '/design/change-orders', show: hasDesignAccess },
    { label: 'Admin — Approvals', path: '/admin/approvals', show: !!me.user.is_superuser },
    { label: 'Admin — Projects', path: '/admin/projects', show: !!me.user.is_superuser },
    { label: 'Admin — Users', path: '/admin/users', show: !!me.user.is_superuser },
  ]

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar ── */}
      <Box
        sx={{
          width: 260,
          flexShrink: 0,
          bgcolor: 'background.paper',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Brand + user */}
        <Box sx={{ px: 3, pt: 3, pb: 2.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>
            Alufit
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {me.user.full_name}
          </Typography>
        </Box>

        <Divider />

        {/* Scrollable nav + projects area */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 2, pb: 1 }}>
          {/* Navigation */}
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              mb: 0.75,
              display: 'block',
              color: 'text.disabled',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontSize: '0.65rem',
            }}
          >
            Navigation
          </Typography>
          <Stack spacing={0.5}>
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const active = isActive(item.path)
                return (
                  <Button
                    key={item.path}
                    fullWidth
                    disableRipple={false}
                    onClick={() => nav(item.path)}
                    sx={{
                      justifyContent: 'flex-start',
                      px: 1.5,
                      py: 0.9,
                      borderRadius: 2,
                      fontSize: '0.875rem',
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active ? '#f3f4f6' : 'transparent',
                      fontWeight: active ? 700 : 500,
                      borderLeft: active ? '3px solid #111827' : '3px solid transparent',
                      '&:hover': {
                        bgcolor: '#f3f4f6',
                        color: 'text.primary',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                )
              })}
            <Button
              fullWidth
              variant="contained"
              onClick={() => nav('/projects?raise=1')}
              sx={{
                mt: 0.75,
                justifyContent: 'flex-start',
                px: 1.5,
                py: 0.9,
                borderRadius: 2,
                fontSize: '0.875rem',
                fontWeight: 700,
                textTransform: 'none',
              }}
            >
              Raise request
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* Project dashboards */}
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              mb: 0.75,
              display: 'block',
              color: 'text.disabled',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              fontSize: '0.65rem',
            }}
          >
            Project Dashboards
          </Typography>
          <Stack spacing={0.5}>
            {me.memberships.map((m) => {
              const path = dashboardPath(m.project_id, m.role)
              const active = isActive(path)
              return (
                <Button
                  key={`${m.project_id}-${m.role}`}
                  fullWidth
                  onClick={() => nav(path)}
                  sx={{
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    flexDirection: 'column',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: active ? '#f3f4f6' : 'transparent',
                    borderLeft: active ? '3px solid #111827' : '3px solid transparent',
                    textAlign: 'left',
                    '&:hover': { bgcolor: '#f3f4f6', color: 'text.primary' },
                  }}
                >
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontWeight: active ? 700 : 500, color: 'inherit', lineHeight: 1.4, width: '100%' }}
                  >
                    {m.project_name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', textTransform: 'capitalize', lineHeight: 1.3 }}
                  >
                    {m.project_code} · {m.role}
                  </Typography>
                </Button>
              )
            })}
            {!me.memberships.length && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
                No projects assigned.
              </Typography>
            )}
          </Stack>
        </Box>

        {/* Sign out — pinned at bottom */}
        <Box sx={{ borderTop: '1px solid #e5e7eb', p: 2 }}>
          <Button
            fullWidth
            color="inherit"
            sx={{
              justifyContent: 'flex-start',
              px: 1.5,
              py: 0.9,
              borderRadius: 2,
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.875rem',
              '&:hover': { bgcolor: '#fef2f2', color: '#b91c1c' },
            }}
            onClick={() => {
              clearTokens()
              nav('/login')
            }}
          >
            Sign out
          </Button>
        </Box>
      </Box>

      {/* ── Main content ── */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          bgcolor: 'background.default',
          minHeight: '100vh',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

function LandingRoute() {
  const { token, me, loading } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (loading) return null
  if (!me) return <Navigate to="/login" replace />
  if (me.user.is_superuser) return <Navigate to="/admin/projects" replace />
  return <Navigate to="/projects" replace />
}

function SuperuserRoute({ element }: { element: ReactElement }) {
  const { token, me, loading } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading…</Typography>
      </Box>
    )
  }
  if (!me) return <Navigate to="/login" replace />
  if (!me.user.is_superuser) return <Navigate to="/" replace />
  return element
}

function ProjectRoleRoute({
  allowed,
  element,
}: {
  allowed: DepartmentRole[]
  element: ReactElement
}) {
  const { token, me, loading } = useAuth()
  const { projectId = '' } = useParams()

  if (!token) return <Navigate to="/login" replace />
  if (loading) return null
  if (!me) return <Navigate to="/login" replace />
  if (me.user.is_superuser) return element

  const membership = me.memberships.find((m) => m.project_id === projectId)
  if (!membership) return <Navigate to="/" replace />
  if (!allowed.includes(membership.role) && membership.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return element
}

function AnyRoleRoute({
  allowed,
  element,
}: {
  allowed: DepartmentRole[]
  element: ReactElement
}) {
  const { token, me, loading } = useAuth()

  if (!token) return <Navigate to="/login" replace />
  if (loading) return null
  if (!me) return <Navigate to="/login" replace />
  if (me.user.is_superuser) return element

  const hasAllowedMembership = me.memberships.some(
    (m) => allowed.includes(m.role) || m.role === 'admin',
  )
  if (!hasAllowedMembership) return <Navigate to="/" replace />
  return element
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/projects" element={<HomePage />} />
        <Route
          path="/approved-boqs"
          element={<AnyRoleRoute allowed={['contracts', 'design']} element={<ApprovedBoqsPage />} />}
        />
        <Route
          path="/contracts/:projectId"
          element={<ProjectRoleRoute allowed={['contracts']} element={<ContractsPage />} />}
        />
        <Route
          path="/contracts/:projectId/boq/:versionId/lines"
          element={<ProjectRoleRoute allowed={['contracts', 'qs', 'design']} element={<BoqLinesPage />} />}
        />
        <Route
          path="/design/:projectId"
          element={<ProjectRoleRoute allowed={['design']} element={<DesignPage />} />}
        />
        <Route
          path="/design/change-orders"
          element={<AnyRoleRoute allowed={['design']} element={<DesignChangeOrdersPage />} />}
        />
        <Route
          path="/design/:projectId/change-order/new"
          element={<ProjectRoleRoute allowed={['design']} element={<CreateChangeOrderPage />} />}
        />
        <Route
          path="/change-orders/:projectId"
          element={<ProjectRoleRoute allowed={['design']} element={<CreateChangeOrderPage />} />}
        />
        <Route path="/qs/:projectId" element={<ProjectRoleRoute allowed={['qs']} element={<QsPage />} />} />
        <Route
          path="/admin"
          element={<SuperuserRoute element={<Navigate to="/admin/projects" replace />} />}
        />
        <Route path="/admin/approvals" element={<SuperuserRoute element={<AdminApprovalsPage />} />} />
        <Route path="/admin/users" element={<SuperuserRoute element={<AdminUsersPage />} />} />
        <Route path="/admin/projects" element={<SuperuserRoute element={<AdminProjectsPage />} />} />
        <Route
          path="/admin/projects/:projectId"
          element={<SuperuserRoute element={<AdminProjectLayout />} />}
        >
          <Route index element={<AdminProjectOverviewTab />} />
          <Route path="analytics" element={<AdminProjectAnalyticsTab />} />
          <Route path="change-orders" element={<AdminProjectChangeOrdersTab />} />
          <Route path="variations" element={<AdminProjectVariationsTab />} />
          <Route path="approvals" element={<AdminProjectApprovalsTab />} />
          <Route
            path="updates"
            element={
              <AdminProjectStubTab
                title="Updates"
                description="Project update feed for this workspace — placeholder."
              />
            }
          />
          <Route path="notifications" element={<AdminProjectNotificationsTab />} />
          <Route path="logs" element={<AdminProjectLogsTab />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
