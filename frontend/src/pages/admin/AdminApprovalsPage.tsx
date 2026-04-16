import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { BoqVersion, ChangeOrder, Project } from '../../types'

type Row = {
  project: Project
  boqPending: number
  changeOrdersPending: number
}

export function AdminApprovalsPage() {
  const nav = useNavigate()
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
  })

  const { data: rows, isLoading: rowsLoading } = useQuery({
    queryKey: ['admin-approvals-summary', (projects ?? []).map((p) => p.id).join('|')],
    enabled: !!projects?.length,
    queryFn: async (): Promise<Row[]> => {
      const list = projects ?? []
      const fetched = await Promise.all(
        list.map(async (p) => {
          const [boq, cos] = await Promise.all([
            api<BoqVersion[]>(`/projects/${p.id}/boq-versions`),
            api<ChangeOrder[]>(`/projects/${p.id}/change-orders`),
          ])
          const boqPending = boq.filter(
            (v) => v.customer_approval_status === 'pending' || v.addition_approval_status === 'pending',
          ).length
          const changeOrdersPending = cos.filter(
            (c) => (c.contracts_approval_status ?? '').toLowerCase() === 'pending',
          ).length
          return { project: p, boqPending, changeOrdersPending }
        }),
      )
      return fetched
        .filter((r) => r.boqPending > 0 || r.changeOrdersPending > 0)
        .sort((a, b) => (b.boqPending + b.changeOrdersPending) - (a.boqPending + a.changeOrdersPending))
    },
  })

  const totalPending = useMemo(() => {
    const list = rows ?? []
    return list.reduce((sum, r) => sum + r.boqPending + r.changeOrdersPending, 0)
  }, [rows])

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 650, mb: 0.5 }}>
          Admin · Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pending BOQ approvals and change-order requests across all projects.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        {isLoading || rowsLoading ? (
          <Typography color="text.secondary">Loading…</Typography>
        ) : !projects?.length ? (
          <Typography color="text.secondary">No projects.</Typography>
        ) : !rows?.length ? (
          <Typography color="text.secondary">Nothing pending.</Typography>
        ) : (
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
              <Chip size="small" label={`Projects with pending: ${rows.length}`} variant="outlined" />
              <Chip size="small" label={`Total pending: ${totalPending}`} color="warning" variant="outlined" />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              {rows.map((r) => (
                <Paper key={r.project.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {r.project.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.project.code}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap' }} useFlexGap>
                    <Chip size="small" label={`BOQ pending: ${r.boqPending}`} color={r.boqPending ? 'warning' : 'default'} variant="outlined" />
                    <Chip
                      size="small"
                      label={`CO pending: ${r.changeOrdersPending}`}
                      color={r.changeOrdersPending ? 'warning' : 'default'}
                      variant="outlined"
                    />
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => nav(`/admin/projects/${r.project.id}/approvals`)}
                    >
                      Open approvals
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={() => nav(`/admin/projects/${r.project.id}`)}
                    >
                      Overview
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        )}
      </Paper>
    </Box>
  )
}

