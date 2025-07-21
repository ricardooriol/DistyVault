import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

// Dynamically import components with heavy dependencies
const SummaryActions = dynamic(() => import('./SummaryActions'), {
  loading: () => <CircularProgress size={20} />,
  ssr: false
})

// Function to fetch summaries on the server side
async function getSummaries() {
  const res = await fetch('http://localhost:3000/api/summaries', {
    next: { revalidate: 0 } // Opt out of caching
  })
  
  if (!res.ok) throw new Error('Failed to fetch summaries')
  return res.json()
}

export default async function SummaryTable() {
  const { summaries } = await getSummaries()

  return (
    <TableContainer 
      component={Paper} 
      elevation={0} 
      sx={{ 
        borderRadius: 2,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        overflow: 'visible',
        '& .MuiTable-root': {
          tableLayout: 'fixed',
        },
        '& .MuiTableCell-head': {
          fontWeight: 600,
          backgroundColor: '#fafafa',
          borderBottom: '2px solid rgba(0, 0, 0, 0.08)',
          whiteSpace: 'nowrap',
          fontSize: '0.9rem',
        },
        '& .MuiTableCell-body': {
          borderColor: 'rgba(0, 0, 0, 0.04)',
          fontSize: '0.95rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '8%' }}>Type</TableCell>
            <TableCell sx={{ width: '15%' }}>Date</TableCell>
            <TableCell sx={{ width: '15%' }}>Status</TableCell>
            <TableCell sx={{ width: '8%' }}>Elapsed</TableCell>
            <TableCell sx={{ width: '20%' }}>Name</TableCell>
            <TableCell sx={{ width: '20%' }}>URL</TableCell>
            <TableCell sx={{ width: '14%' }} align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {summaries.map((s: any) => (
            <TableRow key={s.id} hover>
              <TableCell>{s.type?.toUpperCase()}</TableCell>
              <TableCell>
                {s.date ? new Date(s.date).toLocaleString() : ''}
              </TableCell>
              <TableCell>
                <StatusCell status={s.status} />
              </TableCell>
              <TableCell>
                <Typography sx={{ fontFamily: 'monospace', color: '#666' }}>
                  {s.date && <ElapsedTime start={s.date} status={s.status} />}
                </Typography>
              </TableCell>
              <TableCell>{s.name}</TableCell>
              <TableCell>
                {s.url && (
                  <a 
                    href={s.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ 
                      color: '#1976d2', 
                      textDecoration: 'none' 
                    }}
                  >
                    {s.url}
                  </a>
                )}
              </TableCell>
              <TableCell align="right">
                <Suspense fallback={<CircularProgress size={20} />}>
                  <SummaryActions summary={s} />
                </Suspense>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function StatusCell({ status }: { status: string }) {
  if (status === 'scraping' || status === 'processing') {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} color="primary" />
        {status === 'scraping' ? 'Scraping / Step 1 of 4' : 'Processing / Step 2 of 4'}
      </Box>
    )
  }

  if (status === 'done') {
    return (
      <Typography sx={{ color: '#000', fontWeight: 500 }}>
        Done
      </Typography>
    )
  }

  if (status === 'stopped') {
    return (
      <Typography sx={{ color: '#FF3B30' }}>
        Stopped
      </Typography>
    )
  }

  return null
}
