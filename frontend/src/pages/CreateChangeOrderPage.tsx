import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { api } from '../api/client'
import { WORK_ORDER_HEADING_OPTIONS, pickWorkOrderHeading } from '../constants/workOrderHeadings'
import type { BoqVersion, ChangeOrder, Project, ProjectDocument } from '../types'

const actionBtnSx = {
  textTransform: 'none' as const,
  px: 2.5,
  py: 1.25,
  borderRadius: 2,
  fontWeight: 650,
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

export function CreateChangeOrderPage() {
  const { projectId = '' } = useParams()
  const [searchParams] = useSearchParams()
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
  const versionIdFromQuery = searchParams.get('version') ?? ''
  const selectedDocId = useMemo(() => {
    if (docIdFromQuery && documents?.some((d) => d.id === docIdFromQuery)) return docIdFromQuery
    return documents?.[0]?.id ?? ''
  }, [docIdFromQuery, documents])

  const selectedDoc = useMemo(
    () => documents?.find((d) => d.id === selectedDocId),
    [documents, selectedDocId],
  )

  const approvedBoq = useMemo(() => {
    const list = boqVersions?.filter((b) => b.customer_approval_status === 'approved') ?? []
    if (versionIdFromQuery) {
      const found = list.find((b) => b.id === versionIdFromQuery)
      if (found) return found
    }
    return [...list].sort((a, b) =>
      (b.customer_approval_decided_at ?? b.created_at).localeCompare(
        a.customer_approval_decided_at ?? a.created_at,
      ),
    )[0]
  }, [boqVersions, versionIdFromQuery])

  const coPreviewRef = useMemo(
    () => (project && changeOrders ? nextCoReference(project.code, changeOrders) : '—'),
    [project, changeOrders],
  )

  const [headingDraft, setHeadingDraft] = useState('')
  const [lineDraft, setLineDraft] = useState('')

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

  useEffect(() => {
    if (!selectedDoc) {
      setHeadingDraft('')
      setLineDraft('')
      return
    }
    setLineDraft(selectedDoc.title)
    const stored = (selectedDoc.work_order_heading || '').trim()
    const fallback = (approvedBoq?.form_project_name || approvedBoq?.label || '').trim()
    const next = pickWorkOrderHeading(stored, fallback)
    setHeadingDraft(next)
    if (next !== stored) {
      patchDocument.mutate({ work_order_heading: next })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- patchDocument.mutate is stable
  }, [
    selectedDoc?.id,
    selectedDoc?.title,
    selectedDoc?.work_order_heading,
    approvedBoq?.form_project_name,
    approvedBoq?.label,
    approvedBoq?.id,
  ])

  const routeRequest = useMutation({
    mutationFn: async ({
      requestKind,
      destination,
    }: {
      requestKind: 'quantity_variation' | 'addition_new_item'
      destination: 'qs' | 'contracts'
    }) => {
      if (!approvedBoq) throw new Error('No approved BOQ available')
      // Ensure the selected document is up-to-date before routing the change order.
      // The routing flow relies on the document's persisted work_order_heading/title.
      if (selectedDocId && selectedDoc) {
        const nextHeading = headingDraft.trim()
        const nextTitle = lineDraft.trim()
        const patch: { work_order_heading?: string; title?: string } = {}
        const curHeading = (selectedDoc.work_order_heading || '').trim()
        if (nextHeading && nextHeading !== curHeading) patch.work_order_heading = nextHeading
        const curTitle = (selectedDoc.title || '').trim()
        if (nextTitle && nextTitle !== curTitle) patch.title = nextTitle
        if (Object.keys(patch).length) {
          await api<ProjectDocument>(`/projects/${projectId}/documents/${selectedDocId}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
          })
          void qc.invalidateQueries({ queryKey: ['docs', projectId] })
        }
      }
      const created = await api<ChangeOrder>(`/projects/${projectId}/design/change-orders`, {
        method: 'POST',
        body: JSON.stringify({
          reference: coPreviewRef,
          boq_version_id: approvedBoq.id,
          request_kind: requestKind,
        }),
      })
      const endpoint =
        destination === 'qs'
          ? `/projects/${projectId}/design/change-orders/${created.id}/send-to-qs`
          : `/projects/${projectId}/design/change-orders/${created.id}/send-to-contracts`
      return api<ChangeOrder>(endpoint, { method: 'POST' })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['change-orders', projectId] })
    },
  })

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
    <Box
      sx={{
        minHeight: 'calc(100vh - 24px)',
        bgcolor: 'grey.50',
        p: { xs: 2, md: 3 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 1100,
          mx: 'auto',
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          border: '1px solid #e5e7eb',
          bgcolor: '#fff',
        }}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0 }}>
              <Link
                component={RouterLink}
                to="/approved-boqs"
                sx={{ display: 'inline-block', mb: 0.75, color: 'text.secondary', fontWeight: 600 }}
              >
                ← Back to Approved BOQs
              </Link>
              <Typography variant="h4" sx={{ fontWeight: 750, letterSpacing: -0.5 }}>
                Change order
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Project: <strong>{project?.name ?? '—'}</strong> · Reference:{' '}
                <strong>{routeRequest.data?.reference ?? coPreviewRef}</strong>
              </Typography>
            </Box>
          </Stack>

      {!documents?.length ? (
          <Alert severity="info">
            Add a project document on the Design page first. Then come back here to raise a change order.
          </Alert>
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                    Document
                  </Typography>
                  <Typography sx={{ fontWeight: 750 }} noWrap>
                    {selectedDoc?.document_number ?? '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {selectedDoc?.title ?? '—'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                  <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.08em' }}>
                    BOQ
                  </Typography>
                  <Typography sx={{ fontWeight: 750 }}>{approvedBoq?.label ?? '—'}</Typography>
                </Box>
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
                <Box sx={{ flex: 3, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Work order heading
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={headingDraft}
                      onChange={(e) => {
                        const v = String(e.target.value)
                        setHeadingDraft(v)
                        if (selectedDoc && v.trim()) patchDocument.mutate({ work_order_heading: v.trim() })
                      }}
                      disabled={patchDocument.isPending || !selectedDoc}
                      renderValue={(v) => (
                        <Typography sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v}
                        </Typography>
                      )}
                      MenuProps={{ PaperProps: { sx: { maxWidth: 720 } } }}
                    >
                      {WORK_ORDER_HEADING_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt} sx={{ whiteSpace: 'normal', alignItems: 'flex-start', py: 1 }}>
                          {opt}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box sx={{ flex: 2, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    Description
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    placeholder="Enter work order line item / description"
                    size="small"
                    value={lineDraft}
                    onChange={(e) => setLineDraft(e.target.value)}
                    onBlur={flushLine}
                    disabled={patchDocument.isPending || !selectedDoc}
                  />
                </Box>
              </Stack>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              justifyContent: { xs: 'center', sm: 'space-between' },
              alignItems: 'center',
            }}
          >
            <Button
              sx={{
                ...actionBtnSx,
                minWidth: 220,
              }}
              variant="contained"
              disabled={!selectedDoc || routeRequest.isPending || patchDocument.isPending || !approvedBoq}
              onClick={() => routeRequest.mutate({ requestKind: 'quantity_variation', destination: 'qs' })}
            >
              Quantity Variation
            </Button>
            <Button
              sx={{ ...actionBtnSx, minWidth: 220 }}
              variant="contained"
              disabled={!selectedDoc || routeRequest.isPending || patchDocument.isPending || !approvedBoq}
              onClick={() => routeRequest.mutate({ requestKind: 'addition_new_item', destination: 'contracts' })}
            >
              Addition of New Item
            </Button>
          </Box>
          {routeRequest.isSuccess && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Request sent.
            </Alert>
          )}
          {routeRequest.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {(routeRequest.error as Error).message}
            </Alert>
          )}
        </>
      )}
        </Stack>
      </Paper>
    </Box>
  )
}
