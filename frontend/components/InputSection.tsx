'use client'

import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { FileOpen, ContentPaste } from '@mui/icons-material'
import { mutate } from 'swr'

export default function InputSection() {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input })
      })
      
      if (!res.ok) throw new Error('Failed to summarize')
      
      setInput('')
      // Revalidate the summaries list
      mutate('/api/summaries')
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    const fileType = file.name.endsWith('.pdf') ? 'pdf' : 
                    file.name.endsWith('.docx') ? 'docx' : 'txt'
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileType', fileType)
    
    try {
      const res = await fetch('/api/summarize-file', {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) throw new Error('Failed to upload file')
      
      // Revalidate the summaries list
      mutate('/api/summaries')
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      display="flex" 
      flexDirection={{ xs: 'column', md: 'row' }} 
      alignItems="center" 
      gap={2} 
      mb={5}
    >
      <TextField
        inputRef={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Paste URL or YouTube link"
        variant="outlined"
        fullWidth
        size="large"
        sx={{
          '& .MuiOutlinedInput-root': {
            height: '56px',
            fontSize: '1rem',
            '& fieldset': {
              borderWidth: '1px',
              borderColor: 'transparent',
            },
            '&.Mui-focused': {
              '& fieldset': {
                borderColor: '#000',
                borderWidth: '1px',
              },
            },
          },
          '& .MuiOutlinedInput-input': {
            '&::placeholder': {
              color: 'rgba(0,0,0,0.6)',
              fontWeight: 400,
            },
          },
        }}
      />
      <Tooltip title="Paste from clipboard">
        <IconButton 
          color="primary" 
          onClick={() => {
            navigator.clipboard.readText().then(text => setInput(text))
          }}
        >
          <ContentPaste />
        </IconButton>
      </Tooltip>
      <Tooltip title="Upload file">
        <IconButton color="primary" component="label">
          <FileOpen />
          <input 
            type="file" 
            hidden 
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }} 
          />
        </IconButton>
      </Tooltip>
      <Button 
        type="submit"
        variant="contained"
        size="large"
        disabled={isSubmitting}
        sx={{ 
          minWidth: 140, 
          fontWeight: 600,
          backgroundColor: '#000',
          color: '#fff',
          '&:hover': {
            backgroundColor: '#333',
          }
        }}
      >
        {isSubmitting ? 'Processing...' : 'Summarize'}
      </Button>
    </Box>
  )
}
