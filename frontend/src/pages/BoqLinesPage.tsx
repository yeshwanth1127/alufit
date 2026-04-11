import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'

type Line = {
  id: string
  line_no: string
  description: string
  uom: string | null
  quantity: number
  rate: number
  amount: number
}

type Page = {
  items: Line[]
  next_cursor: string | null
  total_count: number
}

export function BoqLinesPage() {
  const { versionId = '' } = useParams()
  const [cursor, setCursor] = useState<string | null>(null)
  const [stack, setStack] = useState<(string | null)[]>([])

  const { data, isFetching } = useQuery({
    queryKey: ['boq-lines', versionId, cursor],
    queryFn: () => {
      const q = cursor != null ? `?cursor=${cursor}&limit=80` : '?limit=80'
      return api<Page>(`/boq-versions/${versionId}/lines${q}`)
    },
    enabled: !!versionId,
  })

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        BOQ lines ({data?.total_count ?? '…'} total)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Paginated view; use a full spreadsheet export from your BOQ source for very large files.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '70vh' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Line</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.line_no}</TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell align="right">{row.quantity}</TableCell>
                <TableCell align="right">{row.rate}</TableCell>
                <TableCell align="right">{row.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          disabled={stack.length === 0 || isFetching}
          onClick={() => {
            setStack((s) => {
              const n = [...s]
              const prev = n.pop()
              setCursor(prev ?? null)
              return n
            })
          }}
        >
          Previous page
        </Button>
        <Button
          disabled={!data?.next_cursor || isFetching}
          onClick={() => {
            setStack((s) => [...s, cursor])
            setCursor(data!.next_cursor)
          }}
        >
          Next page
        </Button>
      </Box>
    </Box>
  )
}
