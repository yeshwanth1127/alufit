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
import type { ChangeOrder } from '../../../types'
import { formatIST } from '../../../utils/time'

type Slice = { label: string; value: number; color: string }

export function AdminProjectChangeOrdersTab() {
  const { projectId = '' } = useParams()
  const { data: cos, isLoading, isError } = useQuery({
    queryKey: ['admin-cos', projectId],
    queryFn: () => api<ChangeOrder[]>(`/projects/${projectId}/change-orders`),
    enabled: !!projectId,
    retry: false,
  })

  const rows = useMemo(() => (cos ?? []).slice().sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')), [cos])

  const statusSlices = useMemo<Slice[]>(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
    const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#8b5cf6']
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
    return entries.map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
  }, [rows])

  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const k = r.request_kind ?? '—'
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          Change orders
        </Typography>
        <Typography variant="body2" color="text.secondary">
          All change orders raised across roles for this project.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        {isError ? (
          <Typography color="text.secondary">
            Change orders are not available for your access level on this project.
          </Typography>
        ) : isLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <Stack spacing={2}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' }, gap: 1.5 }}>
              <MetricCard label="Total" value={rows.length} color="#0ea5e9" />
              <MetricCard label="Draft" value={rows.filter((r) => r.status === 'draft').length} color="#f59e0b" />
              <MetricCard label="Issued" value={rows.filter((r) => r.status === 'issued').length} color="#10b981" />
              <MetricCard label="Acknowledged" value={rows.filter((r) => r.status === 'acknowledged_by_qs').length} color="#6366f1" />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                  Status mix
                </Typography>
                <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <DonutChart slices={statusSlices} />
                  <Legend slices={statusSlices} />
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                  Kind mix
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }} useFlexGap>
                  {kindCounts.map(([k, n]) => (
                    <Chip key={k} size="small" label={`${k}: ${n}`} variant="outlined" />
                  ))}
                  {!kindCounts.length && <Typography color="text.secondary">No data</Typography>}
                </Stack>
              </Paper>
            </Box>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
                Change orders (expand for details)
              </Typography>
              {!rows.length ? (
                <Typography color="text.secondary">No change orders.</Typography>
              ) : (
                <Stack spacing={1}>
                  {rows.map((co) => (
                    <Accordion
                      key={co.id}
                      disableGutters
                      elevation={0}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary expandIcon={<span>▾</span>} sx={{ px: 2, py: 0.75 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, width: '100%' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>
                              {co.reference} · {co.request_kind ?? '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {co.created_at ? `${formatIST(co.created_at)} (IST)` : '—'} · {co.id.slice(0, 8)}
                            </Typography>
                          </Box>
                          <Chip size="small" label={co.status} variant="outlined" />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                          <Detail label="Reference" value={co.reference} />
                          <Detail label="Status" value={co.status} />
                          <Detail label="Kind" value={co.request_kind ?? '—'} />
                          <Detail label="BOQ version" value={co.boq_version_id ?? '—'} mono />
                          <Detail label="Design package" value={co.design_package_id ?? '—'} mono />
                          <Detail label="Created" value={co.created_at ? formatIST(co.created_at) : '—'} />
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

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'grey.50' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 650, fontFamily: mono ? 'monospace' : undefined, fontSize: mono ? 12 : undefined }}>
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Change orders chart">
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

