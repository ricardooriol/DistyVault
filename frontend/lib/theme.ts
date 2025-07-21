import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  typography: {
    fontFamily: 'var(--font-inter)',
    h1: {
      fontFamily: 'var(--font-open-sans)',
    },
    h2: {
      fontFamily: 'var(--font-open-sans)',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#f8f8f8',
            '&:hover': {
              backgroundColor: '#f2f2f2',
            },
            '&.Mui-focused': {
              backgroundColor: '#fff',
            },
          },
        },
      },
    },
  },
})

export default theme
