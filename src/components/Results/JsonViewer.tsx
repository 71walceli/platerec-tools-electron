import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import { SnapshotApiResponse } from '../../types/api';

interface JsonViewerProps {
  response: SnapshotApiResponse | null;
  filename?: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ response, filename }) => {
  if (!response) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
        No JSON response to display.
      </Typography>
    );
  }

  const jsonStr = JSON.stringify(response, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
  };

  const handleSave = async () => {
    if (window.electronAPI) {
      const defaultName = filename
        ? `${filename.replace(/\.[^.]+$/, '')}_response.json`
        : 'response.json';
      await window.electronAPI.saveJsonResponse(defaultName, jsonStr);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
        <Tooltip title="Copy JSON">
          <IconButton size="small" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Save JSON">
          <IconButton size="small" onClick={handleSave}>
            <SaveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          bgcolor: 'grey.900',
          color: 'grey.100',
          p: 2,
          borderRadius: 1,
          overflow: 'auto',
          maxHeight: 400,
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          m: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {jsonStr}
      </Box>
    </Box>
  );
};

export default JsonViewer;
