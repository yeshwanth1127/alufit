import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import type { WorkflowTransition } from '../../../types'
import { formatIST } from '../../../utils/time'

export function AdminProjectLogsTab() {
  const { projectId = '' } = useParams()
  const [entityType, setEntityType] = useState('')

  const url = useMemo(() => {
    const base = `/projects/${projectId}/activity?limit=200`
    if (!entityType.trim()) return base
    return `${base}&entity_type=${encodeURIComponent(entityType.trim())}`
  }, [projectId, entityType])

  const { data: activity, isLoading } = useQuery({
    queryKey: ['activity', projectId, entityType],
    queryFn: () => api<WorkflowTransition[]>(url),
    enabled: !!projectId,
  })

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Workflow transitions (audit log) for this project.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Entity type (optional)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="boq_version, change_order, erp_job, qs_run…"
            fullWidth
          />
        </Stack>

        {isLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(activity ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatIST(a.created_at)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {a.entity_type}:{a.entity_id}
                  </TableCell>
                  <TableCell>{a.from_status ?? '—'}</TableCell>
                  <TableCell>{a.to_status}</TableCell>
                  <TableCell>{a.reason ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!activity?.length && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">No events found.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Stack>
  )
}

