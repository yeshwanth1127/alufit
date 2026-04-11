import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { api } from '../api/client'
import type { BoqVersion, ChangeOrder, Project, ProjectDocument } from '../types'

const serif = `'Georgia', 'Times New Roman', serif`

const headYellow = {
  bgcolor: '#ffeb3b',
  border: '2px solid #000',
  fontWeight: 700,
  fontFamily: serif,
  fontSize: '0.85rem',
}

const headBlue = {
  bgcolor: '#90caf9',
  border: '2px solid #000',
  fontWeight: 700,
  fontFamily: serif,
  fontSize: '0.85rem',
}

const cell = {
  border: '2px solid #000',
  fontFamily: serif,
  fontSize: '0.9rem',
  verticalAlign: 'top',
}

const projectNameBanner = {
  bgcolor: '#ffeb3b',
  border: '2px solid #000',
  fontFamily: serif,
  fontWeight: 700,
  px: 2,
  py: 1,
  display: 'inline-block',
}

const fieldInCellSx = {
  '& .MuiOutlinedInput-root': {
    fontFamily: serif,
    fontSize: '0.9rem',
    bgcolor: '#fff',
  },
}

const actionBtnSx = {
  bgcolor: '#90caf9',
  border: '2px solid #000',
  color: '#000',
  textDecoration: 'underline',
  fontFamily: serif,
  textTransform: 'none' as const,
  px: 3,
  py: 1,
  '&:hover': { bgcolor: '#64b5f6' },
}

function nextCoReference(projectCode: string, orders: ChangeOrder[]): string {
  const safe = projectCode.replace(/[^\w-]/g, '').toUpperCase() || 'PRJ'
  const prefix = `CO-${safe}-`
  let max = 0
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${esc}(\\d+)$`, 'i')
  for (const co of orders) {
    const m = co.reference.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function effectiveWorkOrder(doc: ProjectDocument | undefined, boq: BoqVersion | undefined): string {
  if (!doc) return ''
  const s = (doc.work_order_heading || '').trim()
  if (s) return s
  return (boq?.form_project_name || boq?.label || '').trim()
}

export function CreateChangeOrderPage() {
  const { projectId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const nav = useNavigate()
  const qc = useQueryClient()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<Project>(`/projects/${projectId}`),
    enabled: !!projectId,
  })

  const { data: documents } = useQuery({
    queryKey: ['docs', projectId],
    queryFn: () => api<ProjectDocument[]>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  })

  const { data: boqVersions } = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => api<BoqVersion[]>(`/projects/${projectId}/boq-versions`),
    enabled: !!projectId,
  })

  const { data: changeOrders } = useQuery({
    queryKey: ['change-orders', projectId],
    queryFn: () => api<ChangeOrder[]>(`/projects/${projectId}/design/change-orders`),
    enabled: !!projectId,
  })

  const docIdFromQuery = searchParams.get('doc') ?? ''
  const selectedDocId = useMemo(() => {
    if (docIdFromQuery && documents?.some((d) => d.id === docIdFromQuery)) return docIdFromQuery
    return documents?.[0]?.id ?? ''
  }, [docIdFromQuery, documents])

  const selectedDoc = useMemo(
    () => documents?.find((d) => d.id === selectedDocId),
    [documents, selectedDocId],
  )

  const qtySubmitted = Boolean(selectedDoc?.quantity_variation_submitted_at)

  const approvedBoq = useMemo(() => {
    const list = boqVersions?.filter((b) => b.customer_approval_status === 'approved') ?? []
    return [...list].sort((a, b) =>
      (b.customer_approval_decided_at ?? b.created_at).localeCompare(
        a.customer_approval_decided_at ?? a.created_at,
      ),
    )[0]
  }, [boqVersions])

  const coPreviewRef = useMemo(
    () => (project && changeOrders ? nextCoReference(project.code, changeOrders) : '—'),
    [project, changeOrders],
  )

  const [headingDraft, setHeadingDraft] = useState('')
  const [lineDraft, setLineDraft] = useState('')

  useEffect(() => {
    if (!selectedDoc) {
      setHeadingDraft('')
      setLineDraft('')
      return
    }
    setLineDraft(selectedDoc.title)
    const stored = (selectedDoc.work_order_heading || '').trim()
    const fallback = (approvedBoq?.form_project_name || approvedBoq?.label || '').trim()
    setHeadingDraft(stored || fallback)
  }, [selectedDoc?.id, selectedDoc?.title, selectedDoc?.work_order_heading, approvedBoq?.form_project_name, approvedBoq?.label, approvedBoq?.id])

  const patchDocument = useMutation({
    mutationFn: async (body: { title?: string; work_order_heading?: string }) => {
      if (!selectedDocId) throw new Error('No document')
      return api<ProjectDocument>(`/projects/${projectId}/documents/${selectedDocId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['docs', projectId] })
    },
  })

  const submitQtyToQs = useMutation({
    mutationFn: async () => {
      if (!selectedDocId) throw new Error('No document')
      return api<ProjectDocument>(
        `/projects/${projectId}/documents/${selectedDocId}/submit-quantity-variation-to-qs`,
        { method: 'POST' },
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['docs', projectId] })
    },
  })

  function flushHeading() {
    if (!selectedDoc) return
    const next = headingDraft.trim()
    if (next === effectiveWorkOrder(selectedDoc, approvedBoq)) return
    patchDocument.mutate({ work_order_heading: next })
  }

  function flushLine() {
    if (!selectedDoc) return
    const next = lineDraft.trim()
    if (!next) {
      setLineDraft(selectedDoc.title)
      return
    }
    if (next === selectedDoc.title) return
    patchDocument.mutate({ title: next })
  }

  if (!projectId) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Invalid project.</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={projectNameBanner}>
          <Typography component="span" sx={{ fontSize: '1.1rem' }}>
            {project?.name ?? '—'}
          </Typography>
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontFamily: serif,
            fontWeight: 700,
            letterSpacing: 0.5,
            textAlign: 'right',
          }}
        >
          Design Team
        </Typography>
      </Box>

      <Link component={RouterLink} to={`/design/${projectId}`} sx={{ display: 'inline-block', mb: 2, fontFamily: serif }}>
        ← Back to Design
      </Link>

      {!documents?.length ? (
        <Typography sx={{ mb: 2 }}>Add a project document on the Design page first.</Typography>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ ...headYellow, display: 'inline-block', px: 1.5, py: 0.75, mb: 0 }}>DOC NO.</Box>
            <Box
              sx={{
                border: '2px solid #000',
                borderTop: 0,
                p: 1.5,
                fontFamily: serif,
                bgcolor: '#fff',
              }}
            >
              <Typography sx={{ fontWeight: 700 }}>{selectedDoc?.document_number ?? '—'}</Typography>
              <Typography sx={{ fontWeight: 700 }}>{coPreviewRef}</Typography>
            </Box>
          </Box>

          {qtySubmitted && (
            <Alert severity="success" sx={{ mb: 2, maxWidth: 900, fontFamily: serif }}>
              Submitted to QS team
              {selectedDoc?.quantity_variation_submitted_at
                ? ` — ${new Date(selectedDoc.quantity_variation_submitted_at).toLocaleString()}`
                : ''}
            </Alert>
          )}

          {submitQtyToQs.isError && (
            <Alert severity="error" sx={{ mb: 2, maxWidth: 900 }}>
              {(submitQtyToQs.error as Error).message}
            </Alert>
          )}

          <Table size="small" sx={{ borderCollapse: 'collapse', mb: 3, maxWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headYellow}>Work Order Heading</TableCell>
                <TableCell sx={headYellow}>Work Order Line item / Description</TableCell>
                <TableCell sx={headBlue}>BOQ Reference if needed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={cell}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                    value={headingDraft}
                    onChange={(e) => setHeadingDraft(e.target.value)}
                    onBlur={flushHeading}
                    disabled={patchDocument.isPending || !selectedDoc}
                    sx={fieldInCellSx}
                  />
                </TableCell>
                <TableCell sx={cell}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                    value={lineDraft}
                    onChange={(e) => setLineDraft(e.target.value)}
                    onBlur={flushLine}
                    disabled={patchDocument.isPending || !selectedDoc}
                    sx={fieldInCellSx}
                  />
                </TableCell>
                <TableCell sx={cell}>{approvedBoq?.label ?? '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', maxWidth: 900 }}>
            <Button
              variant="contained"
              sx={{
                ...actionBtnSx,
                ...(qtySubmitted ? { bgcolor: '#c8e6c9', '&:hover': { bgcolor: '#a5d6a7' } } : {}),
              }}
              disabled={!selectedDoc || submitQtyToQs.isPending || qtySubmitted}
              onClick={() => submitQtyToQs.mutate()}
            >
              {qtySubmitted ? 'Submitted to QS team' : 'Quantity Variation'}
            </Button>
            <Button
              variant="contained"
              sx={actionBtnSx}
              onClick={() => {
                nav(`/contracts/${projectId}?coAction=addition_new_item`)
              }}
            >
              Addition of New Item
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
