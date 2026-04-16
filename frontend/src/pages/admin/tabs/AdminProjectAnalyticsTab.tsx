import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import type { BoqVersion, ChangeOrder, ErpJob, ProjectDocument, WorkflowTransition } from '../../../types'
import { formatIST } from '../../../utils/time'

type Slice = { label: string; value: number; color: string }

export function AdminProjectAnalyticsTab() {
  const { projectId = '' } = useParams()

  const { data: boq } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => api<BoqVersion[]>(`/projects/${projectId}/boq-versions`),
    enabled: !!projectId,
  })
  const { data: docs } = useQuery({
    queryKey: ['docs', projectId],
    queryFn: () => api<ProjectDocument[]>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  })
  const { data: jobs } = useQuery({
    queryKey: ['erp', projectId],
    queryFn: () => api<ErpJob[]>(`/projects/${projectId}/erp-jobs`),
    enabled: !!projectId,
  })
  const { data: activity } = useQuery({
    queryKey: ['activity', projectId],
    queryFn: () => api<WorkflowTransition[]>(`/projects/${projectId}/activity?limit=200`),
    enabled: !!projectId,
  })
  const { data: changeOrders } = useQuery({
    queryKey: ['admin-cos', projectId],
    queryFn: async () => {
      try {
        return await api<ChangeOrder[]>(`/projects/${projectId}/design/change-orders`)
      } catch {
        return []
      }
    },
    enabled: !!projectId,
  })
  const { data: qsRequests } = useQuery({
    queryKey: ['qs-requests', projectId],
    queryFn: async () => {
      try {
        return await api<ChangeOrder[]>(`/projects/${projectId}/qs/requests`)
      } catch {
        return []
      }
    },
    enabled: !!projectId,
  })

  const metrics = useMemo(() => {
    const boqRows = boq ?? []
    const docRows = docs ?? []
    const jobRows = jobs ?? []
    const coRows = changeOrders ?? []
    const reqRows = qsRequests ?? []

    const approvalsPending = boqRows.filter(
      (v) => v.customer_approval_status === 'pending' || v.addition_approval_status === 'pending',
    ).length
    const approvalsApproved = boqRows.filter((v) => v.customer_approval_status === 'approved').length
    const changesRequested = boqRows.filter((v) => v.customer_approval_status === 'changes_requested').length
    const erpOpen = jobRows.filter((j) => j.status === 'queued' || j.status === 'running').length

    return {
      versions: boqRows.length,
      documents: docRows.length,
      changeOrders: coRows.length,
      requestsSent: reqRows.length,
      approvalsPending,
      approvalsApproved,
      changesRequested,
      erpOpen,
    }
  }, [boq, docs, jobs, changeOrders, qsRequests])

  const approvalProgress = useMemo(() => {
    const total = metrics.versions || 1
    return Math.round((metrics.approvalsApproved / total) * 100)
  }, [metrics])

  const volumeSlices = useMemo<Slice[]>(
    () => [
      { label: 'Change orders', value: metrics.changeOrders, color: '#0ea5e9' },
      { label: 'Requests sent', value: metrics.requestsSent, color: '#6366f1' },
      { label: 'Documents', value: metrics.documents, color: '#10b981' },
      { label: 'BOQ versions', value: metrics.versions, color: '#f59e0b' },
    ],
    [metrics],
  )

  const approvalSlices = useMemo<Slice[]>(
    () => [
      { label: 'Approved', value: metrics.approvalsApproved, color: '#16a34a' },
      { label: 'Pending', value: metrics.approvalsPending, color: '#f59e0b' },
      { label: 'Changes requested', value: metrics.changesRequested, color: '#dc2626' },
    ],
    [metrics],
  )

  const latestEvent = (activity ?? [])[0]

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real project metrics for change orders, requests, approvals, BOQ versions, documents, and ERP activity.
        </Typography>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' }, gap: 1.5 }}>
        <MetricCard label="Change Orders" value={metrics.changeOrders} color="#0ea5e9" />
        <MetricCard label="Requests Sent" value={metrics.requestsSent} color="#6366f1" />
        <MetricCard label="Approvals Pending" value={metrics.approvalsPending} color="#f59e0b" />
        <MetricCard label="Changes Requested" value={metrics.changesRequested} color="#dc2626" />
        <MetricCard label="BOQ Versions" value={metrics.versions} color="#f59e0b" />
        <MetricCard label="Documents" value={metrics.documents} color="#10b981" />
        <MetricCard label="Approvals Approved" value={metrics.approvalsApproved} color="#16a34a" />
        <MetricCard label="Open ERP Jobs" value={metrics.erpOpen} color="#ef4444" />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Workload distribution
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <DonutChart slices={volumeSlices} />
            <Legend slices={volumeSlices} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
            Approval outcomes
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <DonutChart slices={approvalSlices} />
            <Legend slices={approvalSlices} />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 650, mb: 0.75 }}>
              Approval completion ({approvalProgress}%)
            </Typography>
            <LinearProgress variant="determinate" value={approvalProgress} sx={{ height: 10, borderRadius: 99 }} />
          </Box>
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
          Timeline
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 1.25 }}>
          <Chip
            size="small"
            label={
              latestEvent
                ? `Last event: ${latestEvent.entity_type} ${formatIST(latestEvent.created_at)} (IST)`
                : 'No events yet'
            }
            variant="outlined"
          />
          <Chip size="small" label={`Tracked events: ${(activity ?? []).length}`} variant="outlined" />
        </Stack>
      </Paper>
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

function Legend({ slices }: { slices: Slice[] }) {
  return (
    <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
      {slices.map((s) => (
        <Box key={s.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: s.color }} />
            <Typography variant="body2">{s.label}</Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>
            {s.value}
          </Typography>
        </Box>
      ))}
    </Stack>
  )
}

function DonutChart({ slices, size = 130 }: { slices: Slice[]; size?: number }) {
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Analytics chart">
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} stroke="#fff" strokeWidth={2} />
      ))}
      <circle cx={cx} cy={cy} r={size * 0.32} fill="#fff" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#334155">
        {total}
      </text>
    </svg>
  )
}

