import React, { useState, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Divider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import ParametersForm from './components/Config/ParametersForm';
import ImageUploader from './components/Image/ImageUploader';
import BoundingBoxCanvas from './components/BoundingBox/BoundingBoxCanvas';
import ResultsTable from './components/Results/ResultsTable';
import JsonViewer from './components/Results/JsonViewer';
import { analyzeImage } from './services/api';
import {
  ImageItem,
  ApiParameters,
  ConnectionConfig,
  SnapshotApiResponse,
} from './types/api';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#42a5f5' },
  },
  typography: {
    fontSize: 13,
  },
});

let imageIdCounter = 0;

const App: React.FC = () => {
  // Connection state
  const [connection, setConnection] = useState<ConnectionConfig>({
    baseUrl: 'https://api.platerecognizer.com/v1/plate-reader/',
    token: '',
  });

  // API parameters
  const [params, setParams] = useState<ApiParameters>({});

  // Image queue
  const [images, setImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState(0);
  const [showVehicleBoxes, setShowVehicleBoxes] = useState(true);

  const currentImage = images[currentIndex] || null;

  // Add images from file input
  const handleAddImages = useCallback((files: File[]) => {
    const newImages: ImageItem[] = files.map((file) => ({
      id: `img-${++imageIdCounter}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setImages((prev) => [...prev, ...newImages]);
    if (images.length === 0) {
      setCurrentIndex(0);
    }
  }, [images.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
    setCurrentIndex((prev) => Math.min(prev, Math.max(0, images.length - 2)));
  }, [images.length]);

  // Analyze current image
  const handleAnalyzeCurrent = useCallback(async () => {
    if (!currentImage) return;

    setLoading(true);
    setError(null);

    // Mark as processing
    setImages((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], status: 'processing' };
      return next;
    });

    try {
      const apiResult = await analyzeImage({
        baseUrl: connection.baseUrl,
        token: connection.token || undefined,
        imageFile: currentImage.file,
        params,
      });

      setImages((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          ...next[currentIndex],
          status: 'complete',
          response: apiResult.normalizedResponse,
          rawResponse: apiResult.rawResponse,
        };
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setImages((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex], status: 'error', error: message };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [currentImage, currentIndex, connection, params]);

  // Analyze all pending images
  const handleAnalyzeAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    for (let i = 0; i < images.length; i++) {
      if (images[i].status === 'complete') continue;

      setCurrentIndex(i);
      setImages((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'processing' };
        return next;
      });

      try {
        const apiResult = await analyzeImage({
          baseUrl: connection.baseUrl,
          token: connection.token || undefined,
          imageFile: images[i].file,
          params,
        });

        setImages((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'complete',
            response: apiResult.normalizedResponse,
            rawResponse: apiResult.rawResponse,
          };
          return next;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setImages((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: message };
          return next;
        });
      }
    }

    setLoading(false);
  }, [images, connection, params]);

  const currentResponse: SnapshotApiResponse | null = currentImage?.response || null;
  const currentRawResponse = currentImage?.rawResponse ?? null;
  const currentResults = currentResponse?.results || [];

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Header */}
        <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper' }}>
          <Toolbar variant="dense">
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              🚗 PlateRecognizer Snapshot API Tester
            </Typography>
            {loading && <CircularProgress size={20} sx={{ mr: 1 }} />}
            <Typography variant="caption" color="text.secondary">
              {images.filter((i) => i.status === 'complete').length}/{images.length} processed
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <Paper
            elevation={0}
            sx={{
              width: 340,
              minWidth: 340,
              overflow: 'auto',
              p: 2,
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <ParametersForm
              connection={connection}
              params={params}
              onConnectionChange={setConnection}
              onParamsChange={setParams}
            />

            <Divider />

            <Typography variant="subtitle2" color="primary">
              Images
            </Typography>

            <ImageUploader
              images={images}
              currentIndex={currentIndex}
              onAddImages={handleAddImages}
              onRemoveImage={handleRemoveImage}
              onSelectImage={setCurrentIndex}
            />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                onClick={handleAnalyzeCurrent}
                disabled={loading || !currentImage || !connection.baseUrl}
                fullWidth
                size="small"
              >
                Analyze Current
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlaylistPlayIcon />}
                onClick={handleAnalyzeAll}
                disabled={loading || images.length === 0 || !connection.baseUrl}
                fullWidth
                size="small"
              >
                Analyze All
              </Button>
            </Box>
          </Paper>

          {/* Main Area */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Image Viewer with Bounding Boxes */}
            <Paper variant="outlined" sx={{ p: 1, flex: '0 0 auto' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  {currentImage ? currentImage.file.name : 'No image selected'}
                  {currentResponse && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      ({currentResponse.processing_time.toFixed(0)}ms, {currentResults.length} plate{currentResults.length !== 1 ? 's' : ''})
                    </Typography>
                  )}
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showVehicleBoxes}
                      onChange={(e) => setShowVehicleBoxes(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="caption">Vehicle boxes</Typography>}
                />
              </Box>

              {currentImage ? (
                <BoundingBoxCanvas
                  imageSrc={currentImage.preview}
                  results={currentResults}
                  showVehicleBoxes={showVehicleBoxes}
                />
              ) : (
                <Box
                  sx={{
                    height: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.900',
                    borderRadius: 1,
                  }}
                >
                  <Typography color="text.secondary">
                    Upload an image to get started
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Results Tabs */}
            <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Tabs
                value={resultTab}
                onChange={(_, v) => setResultTab(v)}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab label="Results Table" />
                <Tab label="JSON Response" />
              </Tabs>

              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {resultTab === 0 && <ResultsTable results={currentResults} />}
                {resultTab === 1 && (
                  <JsonViewer
                    response={currentRawResponse}
                    filename={currentImage?.file.name}
                  />
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App;
