import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
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
import { api } from '../api/client'
import type { BoqVersion, Project, QsRun, QsVariance } from '../types'

export function QsPage() {
  const { projectId = '' } = useParams()
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  })
  const { data: boqVersions } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => api<BoqVersion[]>(`/projects/${projectId}/boq-versions`),
    enabled: !!projectId,
  })
  const { data: runs, refetch: refetchRuns } = useQuery({
    queryKey: ['qs-runs', projectId],
    queryFn: () => api<QsRun[]>(`/projects/${projectId}/qs/runs`),
    enabled: !!projectId,
  })

  const [baseline, setBaseline] = useState('')
  const [target, setTarget] = useState('')
  const [activeRun, setActiveRun] = useState('')
  const { data: variances } = useQuery({
    queryKey: ['qs-var', activeRun],
    queryFn: () => api<QsVariance[]>(`/projects/${projectId}/qs/runs/${activeRun}/variances`),
    enabled: !!projectId && !!activeRun,
  })

  const locked = boqVersions?.filter((b) => b.status === 'locked') ?? []

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        QS — {project?.name}
      </Typography>

      <Typography variant="h6">New comparison run</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ my: 2 }}>
        <TextField
          select
          size="small"
          label="Baseline BOQ"
          value={baseline}
          onChange={(e) => setBaseline(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {locked.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.label} ({b.row_count_snapshot ?? 0} rows)
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Target BOQ"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {locked.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          disabled={!baseline || !target || baseline === target}
          onClick={async () => {
            const r = await api<QsRun>(`/projects/${projectId}/qs/runs`, {
              method: 'POST',
              body: JSON.stringify({ baseline_boq_version_id: baseline, target_boq_version_id: target }),
            })
            setActiveRun(r.id)
            refetchRuns()
          }}
        >
          Create run
        </Button>
      </Stack>

      <Typography variant="h6">Runs</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Mail</TableCell>
            <TableCell>WO</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs?.map((r) => (
            <TableRow key={r.id}>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.id}</TableCell>
              <TableCell>{r.status}</TableCell>
              <TableCell>{r.mail_confirmed ? 'yes' : 'no'}</TableCell>
              <TableCell>{r.work_order_received ? 'yes' : 'no'}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => setActiveRun(r.id)}>
                  View variances
                </Button>
                {r.status === 'draft' && (
                  <Button
                    size="small"
                    onClick={async () => {
                      await api(`/projects/${projectId}/qs/runs/${r.id}/compare`, { method: 'POST' })
                      refetchRuns()
                    }}
                  >
                    Compare
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {activeRun && (
        <>
          <Typography variant="h6" sx={{ mt: 3 }}>
            Variances (first 500 lines)
          </Typography>
          <RunConfirmations projectId={projectId} runId={activeRun} onSaved={() => refetchRuns()} />
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Line</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Variation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {variances?.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{v.line_no}</TableCell>
                  <TableCell>{v.description}</TableCell>
                  <TableCell align="right">{v.variation_amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  )
}

function RunConfirmations({
  projectId,
  runId,
  onSaved,
}: {
  projectId: string
  runId: string
  onSaved: () => void
}) {
  const [mail, setMail] = useState(false)
  const [wo, setWo] = useState(false)
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <FormControlLabel control={<Checkbox checked={mail} onChange={(e) => setMail(e.target.checked)} />} label="Mail confirmed" />
      <FormControlLabel
        control={<Checkbox checked={wo} onChange={(e) => setWo(e.target.checked)} />}
        label="Work order received"
      />
      <Button
        size="small"
        variant="outlined"
        onClick={async () => {
          await api(`/projects/${projectId}/qs/runs/${runId}/confirmations`, {
            method: 'POST',
            body: JSON.stringify({ mail_confirmed: mail, work_order_received: wo }),
          })
          onSaved()
        }}
      >
        Save confirmations
      </Button>
    </Stack>
  )
}
