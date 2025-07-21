'use client'

import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { 
  Download, 
  PictureAsPdf, 
  Stop, 
  Delete, 
  Info, 
  Visibility 
} from '@mui/icons-material'
import jsPDF from 'jspdf'
import { mutate } from 'swr'

type Summary = {
  id: string
  type: string
  date: string
  status: string
  name: string
  url: string
  summary: string
  sourceContent?: string
}

export default function SummaryActions({ summary }: { summary: Summary }) {
  const [showDetail, setShowDetail] = useState(false)
  const [showSource, setShowSource] = useState(false)

  const handleDownloadTxt = () => {
    const blob = new Blob([summary.summary], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `summary_${summary.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdf = () => {
    const doc = new jsPDF()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(summary.name || 'Summary', 10, 20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(summary.summary || '', 10, 40, { maxWidth: 180 })
    doc.save(`summary_${summary.id}.pdf`)
  }

  const handleStop = async () => {
    try {
      await fetch(`/api/summaries/${summary.id}/stop`, { method: 'POST' })
      mutate('/api/summaries')
    } catch (error) {
      console.error('Error stopping summary:', error)
    }
  }

  const handleDelete = async () => {
    try {
      await fetch(`/api/summaries/${summary.id}`, { method: 'DELETE' })
      mutate('/api/summaries')
    } catch (error) {
      console.error('Error deleting summary:', error)
    }
  }

  return (
    <>
      <Tooltip title="Download TXT">
        <IconButton onClick={handleDownloadTxt} sx={{ color: '#000' }}>
          <Download />
        </IconButton>
      </Tooltip>
      <Tooltip title="Download PDF">
        <IconButton onClick={handleDownloadPdf} sx={{ color: '#000' }}>
          <PictureAsPdf />
        </IconButton>
      </Tooltip>
      {(summary.status === 'scraping' || summary.status === 'processing') && (
        <Tooltip title="Stop">
          <IconButton 
            sx={{ color: '#FF3B30' }} 
            onClick={handleStop}
          >
            <Stop />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Delete">
        <IconButton 
          sx={{ color: '#FF3B30' }}
          onClick={handleDelete}
        >
          <Delete />
        </IconButton>
      </Tooltip>
      <Tooltip title="Details">
        <IconButton 
          sx={{ color: '#000' }}
          onClick={() => setShowDetail(true)}
        >
          <Info />
        </IconButton>
      </Tooltip>
      <Tooltip title="View Source">
        <IconButton 
          sx={{ color: '#000' }}
          onClick={() => setShowSource(true)}
        >
          <Visibility />
        </IconButton>
      </Tooltip>

      <Dialog 
        open={showDetail} 
        onClose={() => setShowDetail(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: '1.5rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          borderBottom: '1px solid rgba(0,0,0,0.08)'
        }}>
          Summary Details
        </DialogTitle>
        <DialogContent>
          <Box mb={3} mt={2}>
            <Typography 
              variant="subtitle1" 
              sx={{
                fontWeight: 600,
                fontSize: '1.1rem',
                color: '#000'
              }}
            >
              {summary.type?.toUpperCase()}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{
                color: 'rgba(0,0,0,0.6)',
                mt: 0.5
              }}
            >
              {summary.date}
            </Typography>
          </Box>
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: '1.1rem',
              lineHeight: 1.6,
              color: '#1a1a1a'
            }}
          >
            {summary.summary}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(0,0,0,0.08)', p: 2 }}>
          <Button 
            onClick={() => setShowDetail(false)} 
            sx={{
              color: '#000',
              fontWeight: 500,
              textTransform: 'none'
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={showSource} 
        onClose={() => setShowSource(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: '1.5rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          Source Content
          {summary.url && (
            <Button
              href={summary.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: '#1976d2',
                textTransform: 'none',
                fontSize: '0.9rem'
              }}
            >
              Open in Browser
            </Button>
          )}
        </DialogTitle>
        <DialogContent>
          <Box mb={3} mt={2}>
            <Typography 
              variant="subtitle1" 
              sx={{
                fontWeight: 600,
                fontSize: '1.1rem',
                color: '#000'
              }}
            >
              {summary.type?.toUpperCase()}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{
                color: 'rgba(0,0,0,0.6)',
                mt: 0.5
              }}
            >
              {summary.date}
            </Typography>
          </Box>
          <Typography 
            variant="body1" 
            sx={{ 
              whiteSpace: 'pre-wrap', 
              fontSize: '1rem',
              lineHeight: 1.6,
              color: '#1a1a1a',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}
          >
            {summary.sourceContent || 'Source content not available'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(0,0,0,0.08)', p: 2 }}>
          <Button 
            onClick={() => setShowSource(false)} 
            sx={{
              color: '#000',
              fontWeight: 500,
              textTransform: 'none'
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
