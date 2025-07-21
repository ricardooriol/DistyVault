import { Inter, Open_Sans } from 'next/font/google'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from '../lib/theme'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const openSans = Open_Sans({ subsets: ['latin'], variable: '--font-open-sans' })

export const metadata = {
  title: 'Sawron - Connect the Dots & Fill the Gaps',
  description: 'AI-powered knowledge assistant for summarizing and analyzing content',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${openSans.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
