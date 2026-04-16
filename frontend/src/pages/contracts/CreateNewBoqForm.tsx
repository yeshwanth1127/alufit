import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { apiUpload } from '../../api/client'
import type { BoqVersion } from '../../types'

type Props = {
  projectId: string
  projectName: string
  onSuccess: (version: BoqVersion) => void
  onBack: () => void
}

export function CreateNewBoqForm({ projectId, projectName, onSuccess, onBack }: Props) {
  const [formProjectName, setFormProjectName] = useState(projectName)
  const [clusterHead, setClusterHead] = useState('')
  const [clientName, setClientName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!file) {
      setErr('Please attach a BOQ file.')
      return
    }
    if (!formProjectName.trim() || !clusterHead.trim() || !clientName.trim()) {
      setErr('Fill in all fields.')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('form_project_name', formProjectName.trim())
      fd.append('cluster_head', clusterHead.trim())
      fd.append('client_name', clientName.trim())
      fd.append('file', file)
      const v = await apiUpload<BoqVersion>(`/projects/${projectId}/boq-versions/create-with-upload`, fd)
      onSuccess(v)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', py: { xs: 2, md: 3 }, px: 2 }}>
      <Button variant="text" color="inherit" onClick={onBack} sx={{ mb: 2, px: 0, minWidth: 0, fontWeight: 600 }}>
        ← Back
      </Button>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 2 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
          Contracts
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 650, mb: 0.5 }}>
          Create new BOQ
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter project details and upload your spreadsheet. The file is stored with this BOQ version.
        </Typography>

        <form onSubmit={submit} noValidate>
          <Stack spacing={2.5}>
            <TextField
              label="Project name"
              required
              fullWidth
              size="small"
              value={formProjectName}
              onChange={(e) => setFormProjectName(e.target.value)}
              autoComplete="off"
            />
            <TextField
              label="Cluster head"
              required
              fullWidth
              size="small"
              value={clusterHead}
              onChange={(e) => setClusterHead(e.target.value)}
              autoComplete="off"
            />
            <TextField
              label="Client name"
              required
              fullWidth
              size="small"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              autoComplete="off"
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}>
                Upload BOQ
              </Typography>
              <Box
                sx={{
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'grey.50',
                }}
              >
                <Button variant="outlined" color="inherit" component="label" size="small">
                  Choose file
                  <input
                    type="file"
                    hidden
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Button>
                <Typography variant="body2" sx={{ mt: 1, color: file ? 'text.primary' : 'text.secondary' }}>
                  {file ? file.name : 'No file selected'}
                </Typography>
              </Box>
            </Box>
          </Stack>

          {err && (
            <Alert severity="error" sx={{ mt: 2.5, borderRadius: 1 }}>
              {err}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button type="submit" variant="contained" color="primary" disabled={loading} size="large">
              {loading ? 'Submitting…' : 'Submit'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  )
}
