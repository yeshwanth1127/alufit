import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { api } from '../../api/client'
import type { Project } from '../../types'

type ProjectSummary = {
  project: Project
  boq_versions_count: number
  latest_document_status: string | null
  open_erp_jobs: number
}

const tabs = [
  { label: 'Overview', path: '' },
  { label: 'Analytics', path: 'analytics' },
  { label: 'Change orders', path: 'change-orders' },
  { label: 'Variations', path: 'variations' },
  { label: 'Approvals', path: 'approvals' },
  { label: 'Updates', path: 'updates' },
  { label: 'Notifications', path: 'notifications' },
  { label: 'Logs', path: 'logs' },
] as const

function activeTabIndex(pathname: string, base: string): number {
  const rest = pathname.replace(base, '').replace(/^\//, '')
  const seg = rest.split('/').filter(Boolean)[0] ?? ''
  const idx = tabs.findIndex((t) => t.path === seg)
  return idx >= 0 ? idx : 0
}

export function AdminProjectLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const { projectId = '' } = useParams()
  const base = `/admin/projects/${projectId}`

  const { data: summary } = useQuery({
    queryKey: ['admin-project-summary', projectId],
    queryFn: () => api<ProjectSummary>(`/projects/${projectId}/summary`),
    enabled: !!projectId,
  })

  const tabIndex = activeTabIndex(loc.pathname, base)

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Stack spacing={2.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Button
              variant="text"
              color="inherit"
              onClick={() => nav('/admin/projects')}
              sx={{ mb: 0.5, px: 0, minWidth: 0, fontWeight: 600 }}
            >
              ← Back to projects
            </Button>
            <Typography variant="h5" sx={{ fontWeight: 650 }} noWrap>
              {summary?.project.name ?? 'Project'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summary?.project.code ?? '…'}
            </Typography>
          </Box>

          {summary && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: { md: 320 } }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em', display: 'block', mb: 1 }}>
                Snapshot
              </Typography>
              <Stack spacing={0.75}>
                <Row label="BOQ versions" value={summary.boq_versions_count} />
                <Row label="Latest document" value={summary.latest_document_status ?? '—'} />
                <Row label="Open ERP jobs" value={summary.open_erp_jobs} highlight={summary.open_erp_jobs > 0} />
              </Stack>
            </Paper>
          )}
        </Box>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={tabIndex}
            onChange={(_, next) => {
              const t = tabs[next]
              nav(t.path ? `${base}/${t.path}` : base)
            }}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            {tabs.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>
          <Divider />
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Outlet />
          </Box>
        </Paper>
      </Stack>
    </Box>
  )
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        color={highlight ? 'warning.main' : 'text.primary'}
        sx={{ fontWeight: 650 }}
      >
        {value}
      </Typography>
    </Box>
  )
}

