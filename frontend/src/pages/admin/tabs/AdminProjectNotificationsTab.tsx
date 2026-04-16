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
import { useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import type { WorkflowTransition } from '../../../types'
import { formatIST } from '../../../utils/time'

type Severity = 'info' | 'warning' | 'error' | 'success'

function severityFor(e: WorkflowTransition): Severity {
  const r = (e.reason ?? '').toLowerCase()
  const t = (e.to_status ?? '').toLowerCase()
  if (r.includes('failed') || t.includes('failed') || r.includes('error')) return 'error'
  if (r.includes('rejected') || t.includes('rejected')) return 'error'
  if (r.includes('changes_requested') || t.includes('changes_requested')) return 'warning'
  if (r.includes('pending') || t.includes('pending') || r.includes('awaiting')) return 'warning'
  if (r.includes('approved') || t.includes('approved') || r.includes('succeeded') || t.includes('succeeded')) return 'success'
  return 'info'
}

function chipColor(sev: Severity): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (sev === 'error') return 'error'
  if (sev === 'warning') return 'warning'
  if (sev === 'success') return 'success'
  return 'info'
}

export function AdminProjectNotificationsTab() {
  const { projectId = '' } = useParams()
  const [entityType, setEntityType] = useState('')
  const [q, setQ] = useState('')
  const [before, setBefore] = useState<string | null>(null)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    params.set('limit', '200')
    if (entityType.trim()) params.set('entity_type', entityType.trim())
    if (before) params.set('before', before)
    return `/projects/${projectId}/activity?${params.toString()}`
  }, [projectId, entityType, before])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['notifications', projectId, entityType, before],
    queryFn: () => api<WorkflowTransition[]>(url),
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  })

  const rows = useMemo(() => {
    const list = data ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter((e) => {
      const blob = `${e.entity_type} ${e.entity_id} ${e.from_status ?? ''} ${e.to_status ?? ''} ${e.reason ?? ''}`.toLowerCase()
      return blob.includes(needle)
    })
  }, [data, q])

  const lastTs = (data ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at
  const canLoadMore = !!lastTs && (data ?? []).length >= 200

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          Notifications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every event created by any user for this project (all time), powered by the audit log.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="reason, entity_type, status…"
            fullWidth
          />
          <TextField
            size="small"
            label="Entity type (optional)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="boq_version, erp_job, change_order…"
            sx={{ width: { xs: '100%', md: 280 } }}
          />
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              setBefore(null)
            }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Reset
          </Button>
        </Stack>

        {isLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time (IST)</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Actor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary">No events found.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => {
                    const sev = severityFor(e)
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{formatIST(e.created_at)}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                            <Chip size="small" label={sev} color={chipColor(sev)} variant="outlined" />
                            <Typography variant="body2" sx={{ fontWeight: 650 }}>
                              {e.entity_type}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {e.entity_id.slice(0, 8)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {e.reason ?? '—'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{e.from_status ?? '—'}</TableCell>
                        <TableCell>{e.to_status}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{e.actor_id ? e.actor_id.slice(0, 8) : 'system'}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Showing {data?.length ?? 0} events {isFetching ? ' (refreshing…) ' : ''}
              </Typography>
              <Button
                variant="outlined"
                color="inherit"
                disabled={!canLoadMore}
                onClick={() => {
                  if (lastTs) setBefore(lastTs)
                }}
              >
                Load older
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Stack>
  )
}

