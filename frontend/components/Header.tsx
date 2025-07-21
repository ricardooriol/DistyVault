import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function Header() {
  return (
    <Box sx={{ textAlign: 'center', mb: 6 }}>
      <Typography 
        variant="h1" 
        sx={{ 
          fontSize: { xs: '2.5rem', md: '3.5rem' },
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: '#000',
          textTransform: 'uppercase',
          mb: 2
        }}
      >
        SAWRON
      </Typography>
      <Typography 
        variant="h2" 
        sx={{ 
          fontSize: { xs: '1.25rem', md: '1.5rem' },
          fontWeight: 600,
          color: 'rgba(0,0,0,0.7)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        CONNECT THE DOTS & FILL THE GAPS
      </Typography>
    </Box>
  )
}
