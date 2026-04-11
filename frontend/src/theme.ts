import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3d4f7c' },
    secondary: { main: '#c67b4e' },
    success: { main: '#2e7d4a' },
    error: { main: '#b00020' },
    background: { default: '#f5f6fa', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h5: { fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
})
