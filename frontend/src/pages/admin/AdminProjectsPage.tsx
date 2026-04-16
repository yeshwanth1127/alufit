import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import type { Project } from '../../types'

export function AdminProjectsPage() {
  const nav = useNavigate()
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
  })

  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const list = projects ?? []
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter((p) => `${p.name} ${p.code}`.toLowerCase().includes(needle))
  }, [projects, q])

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 650, mb: 0.5 }}>
          Admin · Projects
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a project to view analytics, approvals, change orders, updates, notifications, and logs.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            label="Search projects"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button variant="outlined" color="inherit" onClick={() => nav('/admin/users')}>
            Users & roles
          </Button>
        </Stack>

        {isLoading ? (
          <Typography color="text.secondary">Loading projects…</Typography>
        ) : !rows.length ? (
          <Typography color="text.secondary">No projects match your search.</Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {rows.map((p) => (
              <Paper
                key={p.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                }}
                onClick={() => nav(`/admin/projects/${p.id}`)}
              >
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {p.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {p.code}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  )
}

