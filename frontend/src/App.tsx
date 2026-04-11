import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { api, clearTokens, getAccessToken } from './api/client'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ContractsPage } from './pages/ContractsPage'
import { DesignPage } from './pages/DesignPage'
import { CreateChangeOrderPage } from './pages/CreateChangeOrderPage'
import { QsPage } from './pages/QsPage'
import { AdminPage } from './pages/AdminPage'
import { BoqLinesPage } from './pages/BoqLinesPage'
import type { Me } from './types'

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
  if (!token) return <Navigate to="/login" replace />
  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Loading…</Typography>
      </Box>
    )
  }
  if (!me) {
    clearTokens()
    return <Navigate to="/login" replace />
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar>
          <Typography sx={{ flexGrow: 1, fontWeight: 600 }} component="button" onClick={() => nav('/')} style={{ cursor: 'pointer', border: 'none', background: 'none', font: 'inherit' }}>
            Alufit workflow
          </Typography>
          <Button color="inherit" onClick={() => nav('/')}>
            Projects
          </Button>
          {me.user.is_superuser && (
            <Button color="inherit" onClick={() => nav('/admin')}>
              Admin
            </Button>
          )}
          <Button
            color="inherit"
            onClick={() => {
              clearTokens()
              nav('/login')
            }}
          >
            Sign out
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} sx={{ flex: 1, py: 0 }}>
        <Outlet />
      </Container>
    </Box>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/contracts/:projectId" element={<ContractsPage />} />
        <Route path="/contracts/:projectId/boq/:versionId/lines" element={<BoqLinesPage />} />
        <Route path="/design/:projectId" element={<DesignPage />} />
        <Route path="/design/:projectId/change-order/new" element={<CreateChangeOrderPage />} />
        <Route path="/qs/:projectId" element={<QsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
