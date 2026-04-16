import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import type { BoqVersion } from '../../../types'
import { formatIST } from '../../../utils/time'

type Slice = { label: string; value: number; color: string }

export function AdminProjectApprovalsTab() {
  const { projectId = '' } = useParams()
  const { data: boq, isLoading } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => api<BoqVersion[]>(`/projects/${projectId}/boq-versions`),
    enabled: !!projectId,
  })

  const pending = useMemo(() => {
    const list = boq ?? []
    return list
      .filter((v) => v.customer_approval_status === 'pending' || v.addition_approval_status === 'pending')
      .map((v) => ({
        ...v,
        pendingScope:
          v.customer_approval_status === 'pending'
            ? 'Main BOQ'
            : v.addition_approval_status === 'pending'
              ? 'Line additions'
              : '—',
      }))
  }, [boq])

  const totals = useMemo(() => {
    const list = boq ?? []
    return {
      total: list.length,
      approved: list.filter((v) => v.customer_approval_status === 'approved').length,
      pending: list.filter((v) => v.customer_approval_status === 'pending' || v.addition_approval_status === 'pending').length,
      rejected: list.filter((v) => v.customer_approval_status === 'rejected').length,
      changesRequested: list.filter((v) => v.customer_approval_status === 'changes_requested').length,
    }
  }, [boq])

  const slices = useMemo<Slice[]>(() => {
    return [
      { label: 'Approved', value: totals.approved, color: '#16a34a' },
      { label: 'Pending', value: totals.pending, color: '#f59e0b' },
      { label: 'Rejected', value: totals.rejected, color: '#dc2626' },
      { label: 'Changes requested', value: totals.changesRequested, color: '#ef4444' },
    ]
  }, [totals])

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          BOQ customer approvals (main BOQ + post-approval line additions).
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        {isLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' }, gap: 1.5 }}>
              <MetricCard label="Total BOQ versions" value={totals.total} color="#f59e0b" />
              <MetricCard label="Approved" value={totals.approved} color="#16a34a" />
              <MetricCard label="Pending" value={totals.pending} color="#f59e0b" />
              <MetricCard label="Rejected / Changes" value={totals.rejected + totals.changesRequested} color="#dc2626" />
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                Outcomes mix
              </Typography>
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <DonutChart slices={slices} />
                <Legend slices={slices} />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
                Pending approvals (expand for details) · {pending.length}
              </Typography>
              {!pending.length ? (
                <Typography color="text.secondary">Nothing pending.</Typography>
              ) : (
                <Stack spacing={1}>
                  {pending.map((v) => (
                    <Accordion
                      key={v.id}
                      disableGutters
                      elevation={0}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary expandIcon={<span>▾</span>} sx={{ px: 2, py: 0.75 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, width: '100%' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>
                              {v.label}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {v.pendingScope} · {v.id.slice(0, 8)}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Chip size="small" label={`main: ${v.customer_approval_status}`} variant="outlined" />
                            <Chip size="small" label={`add: ${v.addition_approval_status}`} variant="outlined" />
                          </Stack>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                          <Detail label="Main submitted" value={v.customer_submitted_for_approval_at ? formatIST(v.customer_submitted_for_approval_at) : '—'} />
                          <Detail label="Main decided" value={v.customer_approval_decided_at ? formatIST(v.customer_approval_decided_at) : '—'} />
                          <Detail label="Additions submitted" value={v.addition_submitted_for_approval_at ? formatIST(v.addition_submitted_for_approval_at) : '—'} />
                          <Detail label="Additions decided" value={v.addition_approval_decided_at ? formatIST(v.addition_approval_decided_at) : '—'} />
                          <Detail label="Main note" value={(v.customer_approval_note ?? '').trim() || '—'} />
                          <Detail label="Additions note" value={(v.addition_approval_note ?? '').trim() || '—'} />
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        )}
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'grey.50' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 650 }}>
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Approvals chart">
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

