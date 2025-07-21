import { Suspense } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Header from '../components/Header'
import InputSection from '../components/InputSection'
import SummaryTable from '../components/SummaryTable'

export default function Home() {
  return (
    <Box sx={{ 
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      py: { xs: 4, md: 6 },
      px: { xs: 2, md: 4 },
    }}>
      <Box 
        sx={{
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Header />
        <InputSection />
        <Box mb={3}>
          <Typography 
            variant="h4" 
            mb={4} 
            sx={{ 
              color: '#000',
              letterSpacing: '-0.03em',
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontWeight: 700
            }}
          >
            Saved Summaries
          </Typography>
          <Suspense fallback={<div>Loading...</div>}>
            <SummaryTable />
          </Suspense>
        </Box>
      </Box>
    </Box>
  )
}
