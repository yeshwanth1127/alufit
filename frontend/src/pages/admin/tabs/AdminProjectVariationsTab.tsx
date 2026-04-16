import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import type { ChangeOrder, QsRun, QsVariance } from '../../../types'
import { formatIST } from '../../../utils/time'

type PieSlice = { label: string; value: number; color: string }

/** Per BOQ version (QS run target): rate-change effect Σ (Δ rate × current qty). */
type PriceVariationInfo = { totalPriceEffect: number; hasRateChange: boolean }

async function fetchPriceVariationByBoqVersion(projectId: string): Promise<Record<string, PriceVariationInfo>> {
  const runs = await api<QsRun[]>(`/projects/${projectId}/qs/runs`)
  if (!runs.length) return {}
  const active = runs.filter((r) => r.status !== 'draft')
  const sorted = [...active].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const latestPerTarget: QsRun[] = []
  const seen = new Set<string>()
  for (const r of sorted) {
    if (seen.has(r.target_boq_version_id)) continue
    seen.add(r.target_boq_version_id)
    latestPerTarget.push(r)
  }
  const out: Record<string, PriceVariationInfo> = {}
  await Promise.all(
    latestPerTarget.map(async (r) => {
      const variances = await api<QsVariance[]>(
        `/projects/${projectId}/qs/runs/${r.id}/variances?limit=2000`,
      )
      let totalPriceEffect = 0
      let hasRateChange = false
      for (const v of variances) {
        totalPriceEffect += (v.current_rate - v.initial_rate) * v.current_qty
        if (v.initial_rate !== v.current_rate) hasRateChange = true
      }
      out[r.target_boq_version_id] = { totalPriceEffect, hasRateChange }
    }),
  )
  return out
}

function formatInr(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AdminProjectVariationsTab() {
  const nav = useNavigate()
  const { projectId = '' } = useParams()
  const { data: variations, isLoading } = useQuery({
    queryKey: ['qs-requests', projectId],
    queryFn: () => api<ChangeOrder[]>(`/projects/${projectId}/qs/requests`),
    enabled: !!projectId,
  })

  const { data: priceByBoqVersion = {} } = useQuery({
    queryKey: ['admin-qs-price-variation', projectId],
    queryFn: () => fetchPriceVariationByBoqVersion(projectId),
    enabled: !!projectId,
  })

  const statusSlices = useMemo((): PieSlice[] => {
    const list = variations ?? []
    const counts = new Map<string, number>()
    for (const r of list) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)

    const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#8b5cf6']
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
    return entries.map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
  }, [variations])

  const rows = useMemo(() => {
    return (variations ?? [])
      .slice()
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  }, [variations])

  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) => {
      const ref = (r.reference || '').toLowerCase()
      const status = (r.status || '').toLowerCase()
      const boq = (r.boq_version_id || '').toLowerCase()
      return `${ref} ${status} ${boq}`.includes(needle)
    })
  }, [rows, q])

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          Variations
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real quantity-variation change orders (QS requests) for this project.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            label="Search variations"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="CO reference, status, BOQ id…"
          />
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => nav(`/qs/${projectId}`)}
            disabled={!projectId}
          >
            Open QS
          </Button>
        </Stack>

        {isLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : !(variations ?? []).length ? (
          <Stack spacing={1}>
            <Typography color="text.secondary">
              No quantity-variation requests for this project yet.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              These appear when a change order is routed to QS as a <strong>quantity variation</strong>.
            </Typography>
          </Stack>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 420px) minmax(0, 1fr)' },
                gap: 2,
                mb: 2,
              }}
            >
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                  Variation status mix
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                  <MiniPie size={120} slices={statusSlices} />
                  <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                    {!statusSlices.length ? (
                      <Typography color="text.secondary">No data</Typography>
                    ) : (
                      statusSlices.slice(0, 6).map((s) => (
                        <Box
                          key={s.label}
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: s.color }} />
                            <Typography variant="body2" noWrap>
                              {s.label}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 650 }}>
                            {s.value}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Stack>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                  Snapshot
                </Typography>
                <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                    <Chip label={`Total variations: ${variations?.length ?? 0}`} size="small" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      Latest {rows[0]?.created_at ? formatIST(rows[0].created_at) : '—'} (IST)
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Quantity variations
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Reference</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>BOQ</TableCell>
                  <TableCell align="right">Price variation (₹)</TableCell>
                  <TableCell>Created (IST)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((co) => {
                  const bid = co.boq_version_id || ''
                  const pv = bid ? priceByBoqVersion[bid] : undefined
                  const showPrice =
                    pv?.hasRateChange === true
                      ? formatInr(pv.totalPriceEffect)
                      : '—'
                  return (
                    <TableRow key={co.id}>
                      <TableCell sx={{ fontWeight: 650 }}>{co.reference}</TableCell>
                      <TableCell>{co.status}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {co.boq_version_id ? co.boq_version_id.slice(0, 8) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {showPrice}
                      </TableCell>
                      <TableCell>{co.created_at ? formatIST(co.created_at) : '—'}</TableCell>
                    </TableRow>
                  )
                })}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">No variations match your search.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>
    </Stack>
  )
}

function MiniPie({ slices, size }: { slices: PieSlice[]; size: number }) {
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Variation status pie chart">
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} stroke="#ffffff" strokeWidth={2} />
      ))}
      <circle cx={cx} cy={cy} r={size * 0.28} fill="#ffffff" />
    </svg>
  )
}

