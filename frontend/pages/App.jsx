import React, { useState, useEffect, useRef } from 'react';
import { ElapsedTime } from '../components/ElapsedTime';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  CircularProgress,
  useMediaQuery
} from '@mui/material';
import { FileOpen, ContentPaste, Download, Delete, Info, PictureAsPdf, Stop } from '@mui/icons-material';
import jsPDF from 'jspdf';

function App() {
  const [input, setInput] = useState('');
  const [summaries, setSummaries] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [showDetail, setShowDetail] = useState(null);
  const inputRef = useRef();

  useEffect(() => {
    const fetchSummaries = async () => {
      const res = await axios.get('/api/summaries');
      setSummaries(res.data.summaries);
    };
    fetchSummaries();
    const interval = setInterval(fetchSummaries, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingId('pending');
    const res = await axios.post('/api/summarize', { text: input });
    setSummaries([res.data, ...summaries.filter(s => s.id !== res.data.id)]);
    setInput('');
    setLoadingId(null);
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 6 } }}>
      {/* Title and slogan handled by Header.jsx */}
      <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection={{ xs: 'column', md: 'row' }} alignItems="center" gap={2} mb={5}>
        <TextField
          inputRef={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste URL or YouTube link"
          variant="outlined"
          fullWidth
          size="large"
        />
        <Tooltip title="Paste from clipboard">
          <IconButton color="primary" onClick={() => navigator.clipboard.readText().then(text => setInput(text))}>
            <ContentPaste />
          </IconButton>
        </Tooltip>
        <Tooltip title="Upload file">
          <IconButton color="primary" component="label">
            <FileOpen />
            <input type="file" hidden onChange={e => {
              if (e.target.files[0]) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const fileType = file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'txt';
                  const fileData = ev.target.result;
                  const res = await axios.post('/api/summarize-file', { fileData, fileType });
                  setSummaries([res.data, ...summaries]);
                };
                reader.readAsArrayBuffer(file);
              }
            }} />
          </IconButton>
        </Tooltip>
        <Button type="submit" variant="contained" size="large" sx={{ minWidth: 140, fontWeight: 600 }}>
          Summarize
        </Button>
      </Box>
      <Box mb={3}>
        <Typography variant="h4" fontWeight={600} mb={2} color="primary.main">
          Saved Summaries
        </Typography>
        <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Elapsed</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>URL</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summaries.map(s => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.type?.toUpperCase()}</TableCell>
                  <TableCell>{s.date ? new Date(s.date).toLocaleString() : ''}</TableCell>
                  <TableCell>
                    {s.status === 'scraping' && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <CircularProgress size={20} color="primary" /> Scraping / Step 1 of 4
                      </Box>
                    )}
                    {s.status === 'processing' && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <CircularProgress size={20} color="primary" /> Processing / Step 2 of 4
                      </Box>
                    )}
                    {s.status === 'done' && (
                      <Typography color="success.main">Done</Typography>
                    )}
                    {s.status === 'stopped' && (
                      <Typography color="error.main">Stopped</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.date && <ElapsedTime start={s.date} />}
                  </TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'none' }}>{s.url}</a> : ''}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Download TXT">
                      <IconButton onClick={() => {
                        const blob = new Blob([s.summary], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `summary_${s.id}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        <Download />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download PDF">
                      <IconButton onClick={() => {
                        const doc = new jsPDF();
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(18);
                        doc.text(s.name || 'Summary', 10, 20);
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(12);
                        doc.text(s.summary || '', 10, 40, { maxWidth: 180 });
                        doc.save(`summary_${s.id}.pdf`);
                      }}>
                        <PictureAsPdf />
                      </IconButton>
                    </Tooltip>
                    {(s.status === 'scraping' || s.status === 'processing') && (
                      <Tooltip title="Stop">
                        <IconButton color="error" onClick={async () => {
                          await axios.post(`/api/summaries/${s.id}/stop`);
                        }}>
                          <Stop />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton color="error" onClick={async () => {
                        await axios.delete(`/api/summaries/${s.id}`);
                        setSummaries(summaries.filter(x => x.id !== s.id));
                      }}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Details">
                      <IconButton color="primary" onClick={() => setShowDetail(s.id)}>
                        <Info />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Dialog open={!!showDetail} onClose={() => setShowDetail(null)} maxWidth="sm" fullWidth>
        {(() => {
          const detail = summaries.find(s => s.id === showDetail);
          if (!detail) return null;
          return (
            <>
              <DialogTitle>Summary Details</DialogTitle>
              <DialogContent dividers>
                <Box mb={2}>
                  <Typography variant="subtitle1" fontWeight={700}>{detail.type?.toUpperCase()}</Typography>
                  <Typography variant="body2" color="text.secondary">{detail.date}</Typography>
                </Box>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem' }}>{detail.summary}</Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowDetail(null)} color="primary">Close</Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Container>
  );
}

export default App;
