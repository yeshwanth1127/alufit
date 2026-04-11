import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { api, setTokens } from '../api/client'

export function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('contracts@alufit.local')
  const [password, setPassword] = useState('demo123')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const t = await api<{ access_token: string; refresh_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      })
      setTokens(t.access_token, t.refresh_token)
      nav('/')
    } catch {
      setErr('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        background: 'linear-gradient(145deg, #e8eaf2 0%, #f5f6fa 40%, #dde3f0 100%)',
      }}
    >
      <Card elevation={4} sx={{ maxWidth: 420, width: 1 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>
            Alufit workflow
          </Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
            Sign in with your department account (seed: contracts@alufit.local / demo123)
          </Typography>
          <form onSubmit={submit}>
            <Stack spacing={2}>
              {err && <Alert severity="error">{err}</Alert>}
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Admin: admin@alufit.local / admin123
              </Typography>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}
