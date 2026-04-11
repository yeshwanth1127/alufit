import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Link,
  Stack,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../api/client'
import type { Me, Project } from '../types'

export function HomePage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/auth/me'),
  })
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
  })

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Projects
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Signed in as {me?.user.full_name} ({me?.user.email})
      </Typography>
      <Stack spacing={2}>
        {projects?.map((p) => (
          <Card key={p.id} variant="outlined">
            <CardActionArea component={RouterLink} to={`/contracts/${p.id}`}>
              <CardContent>
                <Typography variant="h6">{p.name}</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {p.code}
                  {p.erp_connector_key && ` · ERP ${p.erp_connector_key}`}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Link component={RouterLink} to={`/contracts/${p.id}`} onClick={(e) => e.stopPropagation()}>
                    Contracts
                  </Link>
                  <Link component={RouterLink} to={`/design/${p.id}`} onClick={(e) => e.stopPropagation()}>
                    Design
                  </Link>
                  <Link component={RouterLink} to={`/qs/${p.id}`} onClick={(e) => e.stopPropagation()}>
                    QS
                  </Link>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        {!projects?.length && (
          <Typography color="text.secondary">No projects yet. Run backend seed script after migrations.</Typography>
        )}
      </Stack>
      {me?.user.is_superuser && (
        <Box sx={{ mt: 3 }}>
          <Link component={RouterLink} to="/admin">
            Admin — users &amp; memberships
          </Link>
        </Box>
      )}
    </Container>
  )
}
