import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import type { BoqVersion, ChangeOrder, ErpJob, Project, ProjectDocument, WorkflowTransition } from '../../../types'
import { formatIST } from '../../../utils/time'
import { DirectChangeRequestDialog } from '../../common/DirectChangeRequestDialog'

type Slice = { label: string; value: number; color: string }

export function AdminProjectOverviewTab() {
  const nav = useNavigate()
  const { projectId = '' } = useParams()
  const [directOpen, setDirectOpen] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  })

  const { data: activity } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: () => api<WorkflowTransition[]>(`/projects/${projectId}/activity?limit=50`),
    enabled: !!projectId,
  })
  const { data: boq } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => api<BoqVersion[]>(`/projects/${projectId}/boq-versions`),
    enabled: !!projectId,
  })
  const { data: jobs } = useQuery({
    queryKey: ['erp', projectId],
    queryFn: () => api<ErpJob[]>(`/projects/${projectId}/erp-jobs`),
    enabled: !!projectId,
  })
  const { data: docs } = useQuery({
    queryKey: ['docs', projectId],
    queryFn: () => api<ProjectDocument[]>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  })
  const { data: cos } = useQuery({
    queryKey: ['admin-cos', projectId],
    queryFn: () => api<ChangeOrder[]>(`/projects/${projectId}/change-orders`),
    enabled: !!projectId,
    retry: false,
  })

  const pendingApprovalsCount = useMemo(() => {
    const list = boq ?? []
    return list.filter((v) => v.customer_approval_status === 'pending' || v.addition_approval_status === 'pending')
      .length
  }, [boq])

  const openJobsCount = useMemo(
    () => (jobs ?? []).filter((j) => j.status === 'queued' || j.status === 'running').length,
    [jobs],
  )
  const latestActivity = activity ?? []

  const versions = boq?.length ?? 0
  const documents = docs?.length ?? 0
  const changeOrders = cos?.length ?? 0

  const workloadSlices = useMemo<Slice[]>(() => {
    return [
      { label: 'Change orders', value: changeOrders, color: '#0ea5e9' },
      { label: 'Documents', value: documents, color: '#10b981' },
      { label: 'BOQ versions', value: versions, color: '#f59e0b' },
      { label: 'Open ERP jobs', value: openJobsCount, color: '#ef4444' },
    ]
  }, [changeOrders, documents, versions, openJobsCount])

  const approvalSlices = useMemo<Slice[]>(() => {
    const list = boq ?? []
    const approved = list.filter((v) => v.customer_approval_status === 'approved').length
    const pending = list.filter((v) => v.customer_approval_status === 'pending' || v.addition_approval_status === 'pending')
      .length
    const changesRequested = list.filter((v) => v.customer_approval_status === 'changes_requested').length
    return [
      { label: 'Approved', value: approved, color: '#16a34a' },
      { label: 'Pending', value: pending, color: '#f59e0b' },
      { label: 'Changes requested', value: changesRequested, color: '#dc2626' },
    ]
  }, [boq])

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' }, gap: 1.5 }}>
        <MetricCard label="Change Orders" value={changeOrders} color="#0ea5e9" />
        <MetricCard label="Pending Approvals" value={pendingApprovalsCount} color="#f59e0b" />
        <MetricCard label="BOQ Versions" value={versions} color="#f59e0b" />
        <MetricCard label="Documents" value={documents} color="#10b981" />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Inbox
          </Typography>
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            <Button variant="outlined" color="inherit" onClick={() => setDirectOpen(true)}>
              Raise change order
            </Button>
            <Button variant="contained" onClick={() => nav(`/admin/projects/${projectId}/approvals`)}>
              Pending approvals ({pendingApprovalsCount})
            </Button>
            <Button variant="outlined" color="inherit" onClick={() => nav(`/admin/projects/${projectId}/change-orders`)}>
              Change orders ({changeOrders})
            </Button>
            <Button variant="outlined" color="inherit" onClick={() => nav(`/admin/projects/${projectId}/notifications`)}>
              Notifications (all events)
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Health
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
            <Chip size="small" variant="outlined" color={openJobsCount > 0 ? 'warning' : 'success'} label={`Open ERP jobs: ${openJobsCount}`} />
            <Chip size="small" variant="outlined" color={pendingApprovalsCount > 0 ? 'warning' : 'success'} label={`Pending approvals: ${pendingApprovalsCount}`} />
            <Chip size="small" variant="outlined" color="info" label={`Events (last 50): ${latestActivity.length}`} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: 'block' }}>
            Latest event: {latestActivity[0]?.created_at ? `${formatIST(latestActivity[0].created_at)} (IST)` : '—'}
          </Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Workload mix
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <DonutChart slices={workloadSlices} />
            <Legend slices={workloadSlices} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Approvals mix
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <DonutChart slices={approvalSlices} />
            <Legend slices={approvalSlices} />
          </Box>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
          Recent activity (expand for details)
        </Typography>

        {!latestActivity.length ? (
          <Typography color="text.secondary">No activity yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {latestActivity.slice(0, 12).map((a) => (
              <Accordion
                key={a.id}
                disableGutters
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  '&:before': { display: 'none' },
                }}
              >
                <AccordionSummary expandIcon={<span>▾</span>} sx={{ px: 2, py: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>
                        {a.entity_type} · {a.reason ?? '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {formatIST(a.created_at)} (IST) · {a.entity_id.slice(0, 8)}
                      </Typography>
                    </Box>
                    <Chip size="small" label={`${a.from_status ?? '—'} → ${a.to_status}`} variant="outlined" />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                    <Detail label="Entity type" value={a.entity_type} />
                    <Detail label="Entity id" value={a.entity_id} mono />
                    <Detail label="From" value={a.from_status ?? '—'} />
                    <Detail label="To" value={a.to_status} />
                    <Detail label="Actor" value={a.actor_id ? a.actor_id : 'system'} mono />
                    <Detail label="Reason" value={a.reason ?? '—'} />
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        )}
      </Paper>

      <DirectChangeRequestDialog open={directOpen} onClose={() => setDirectOpen(false)} project={project} />
    </Stack>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderTop: `3px solid ${color}` }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.25, fontWeight: 700, color }}>
        {value}
      </Typography>
    </Paper>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'grey.50' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 650,
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: mono ? 12 : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function Legend({ slices }: { slices: Slice[] }) {
  return (
    <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
      {slices.map((s) => (
        <Box key={s.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: s.color, flexShrink: 0 }} />
            <Typography variant="body2" noWrap>
              {s.label}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>
            {s.value}
          </Typography>
        </Box>
      ))}
    </Stack>
  )
}

function DonutChart({ slices, size = 120 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const r = size / 2
  const cx = r
  const cy = r

  if (!total) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: 999,
          border: '1px dashed',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          fontSize: 12,
        }}
      >
        No data
      </Box>
    )
  }

  let start = -Math.PI / 2
  const paths = slices.map((s) => {
    const angle = (s.value / total) * Math.PI * 2
    const end = start + angle
    const largeArc = angle > Math.PI ? 1 : 0

    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)

    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    start = end
    return { d, color: s.color, key: s.label }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Overview chart">
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} stroke="#ffffff" strokeWidth={2} />
      ))}
      <circle cx={cx} cy={cy} r={size * 0.33} fill="#ffffff" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#334155">
        {total}
      </text>
    </svg>
  )
}

