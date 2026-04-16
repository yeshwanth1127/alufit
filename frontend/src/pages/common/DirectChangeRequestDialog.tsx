import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { api, apiUpload } from '../../api/client'
import type { ChangeOrder, Project, WorkOrder } from '../../types'

type ChangeType = 'addition_new_item' | 'quantity_variation'

export function DirectChangeRequestDialog({
  open,
  onClose,
  project,
}: {
  open: boolean
  onClose: () => void
  project: Project | undefined
}) {
  const qc = useQueryClient()
  const [clusterHead, setClusterHead] = useState('')
  const [clientName, setClientName] = useState('')
  const [workOrderNo, setWorkOrderNo] = useState('')
  const [changeType, setChangeType] = useState<ChangeType>('addition_new_item')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const defaults = useMemo(() => {
    return {
      cluster: (project?.cluster_head ?? '').trim(),
      client: (project?.client_name ?? '').trim(),
    }
  }, [project?.cluster_head, project?.client_name])

  const { data: latestWo } = useQuery({
    queryKey: ['latest-work-order', project?.id ?? ''],
    enabled: !!project?.id && open,
    queryFn: () => api<WorkOrder>(`/projects/${project!.id}/work-orders/latest`),
    retry: false,
  })

  useEffect(() => {
    if (!open) return
    if (workOrderNo.trim()) return
    const n = latestWo?.work_order_no
    if (typeof n === 'number' && Number.isFinite(n)) {
      setWorkOrderNo(String(n))
      return
    }
    const ref = (latestWo?.reference ?? '').trim()
    if (ref) setWorkOrderNo(ref)
  }, [open, latestWo?.work_order_no, latestWo?.reference, workOrderNo])

  const create = useMutation({
    mutationFn: async () => {
      if (!project?.id) throw new Error('Project is not loaded yet.')

      const payload = {
        request_kind: changeType,
        work_order_no: workOrderNo.trim() || null,
        description: description.trim() || null,
        // optional context for humans; backend stores them in audit metadata today
        cluster_head: clusterHead.trim() || defaults.cluster || null,
        client_name: clientName.trim() || defaults.client || null,
      }

      const co = await api<ChangeOrder>(`/projects/${project.id}/change-orders`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      for (const f of files) {
        const fd = new FormData()
        fd.append('file', f)
        await apiUpload(`/projects/${project.id}/change-orders/${co.id}/attachments`, fd)
      }

      return co
    },
    onSuccess: async () => {
      if (project?.id) {
        await qc.invalidateQueries({ queryKey: ['admin-cos', project.id] })
        await qc.invalidateQueries({ queryKey: ['qs-requests', project.id] })
        await qc.invalidateQueries({ queryKey: ['change-orders', project.id] })
        await qc.invalidateQueries({ queryKey: ['activity', project.id] })
      }
      setClusterHead('')
      setClientName('')
      setWorkOrderNo('')
      setChangeType('addition_new_item')
      setDescription('')
      setFiles([])
      onClose()
    },
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Register direct change request</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Project name" value={project?.name ?? '…'} fullWidth disabled />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Cluster head"
              value={clusterHead}
              placeholder={defaults.cluster || '—'}
              onChange={(e) => setClusterHead(e.target.value)}
              fullWidth
            />
            <TextField
              label="Client name"
              value={clientName}
              placeholder={defaults.client || '—'}
              onChange={(e) => setClientName(e.target.value)}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Work order no."
              value={workOrderNo}
              onChange={(e) => setWorkOrderNo(e.target.value)}
              fullWidth
            />
            <TextField
              label="Change type"
              select
              value={changeType}
              onChange={(e) => setChangeType(e.target.value as ChangeType)}
              fullWidth
            >
              <MenuItem value="addition_new_item">Addition of item</MenuItem>
              <MenuItem value="quantity_variation">Quantity variation</MenuItem>
            </TextField>
          </Stack>

          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />

          <Button variant="outlined" component="label">
            Attach files
            <input
              hidden
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </Button>
          {!!files.length && (
            <Typography variant="caption" color="text.secondary">
              {files.length} file(s) selected: {files.map((f) => f.name).join(', ')}
            </Typography>
          )}

          {create.isError && (
            <Typography color="error" variant="body2">
              {(create.error as Error).message}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={!project?.id || create.isPending}>
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

