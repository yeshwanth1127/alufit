import { Paper, Stack, Typography } from '@mui/material'

export function AdminProjectStubTab({ title, description }: { title: string; description: string }) {
  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 650, mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </Stack>
  )
}

