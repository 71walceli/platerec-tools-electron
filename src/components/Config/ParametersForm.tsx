import React from 'react';
import {
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Typography,
  Divider,
  Box,
  Tooltip,
  IconButton,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ApiParameters, EngineConfig, ConnectionConfig } from '../../types/api';

interface ParametersFormProps {
  connection: ConnectionConfig;
  params: ApiParameters;
  onConnectionChange: (connection: ConnectionConfig) => void;
  onParamsChange: (params: ApiParameters) => void;
}

const ParametersForm: React.FC<ParametersFormProps> = ({
  connection,
  params,
  onConnectionChange,
  onParamsChange,
}) => {
  const config = params.config || {};

  const updateConfig = (updates: Partial<EngineConfig>) => {
    const newConfig = { ...config, ...updates };
    // Remove undefined/null values
    Object.keys(newConfig).forEach((key) => {
      const k = key as keyof EngineConfig;
      if (newConfig[k] === undefined || newConfig[k] === null) {
        delete newConfig[k];
      }
    });
    onParamsChange({
      ...params,
      config: Object.keys(newConfig).length > 0 ? newConfig : undefined,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Connection Settings */}
      <Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>
        Connection
      </Typography>

      <TextField
        label="Base URL"
        value={connection.baseUrl}
        onChange={(e) => onConnectionChange({ ...connection, baseUrl: e.target.value })}
        size="small"
        fullWidth
        placeholder="https://api.platerecognizer.com/v1/plate-reader/"
        helperText="API endpoint URL"
        error={!!connection.baseUrl && !/^https?:\/\/.+/.test(connection.baseUrl)}
      />

      <TextField
        label="API Token"
        value={connection.token}
        onChange={(e) => onConnectionChange({ ...connection, token: e.target.value })}
        size="small"
        fullWidth
        type="password"
        placeholder="Optional for local SDK"
        helperText="Required for cloud API"
      />

      <Divider />

      {/* API Parameters */}
      <Typography variant="subtitle2" color="primary">
        Parameters
      </Typography>

      <TextField
        label="Regions"
        value={(params.regions || []).join(', ')}
        onChange={(e) => {
          const val = e.target.value;
          const regions = val
            ? val.split(',').map((r) => r.trim()).filter(Boolean)
            : undefined;
          onParamsChange({ ...params, regions });
        }}
        size="small"
        fullWidth
        placeholder="us, us-ca, mx"
        helperText="Comma-separated region codes"
      />

      <TextField
        label="Camera ID"
        value={params.camera_id || ''}
        onChange={(e) =>
          onParamsChange({ ...params, camera_id: e.target.value || undefined })
        }
        size="small"
        fullWidth
        placeholder="Optional"
      />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={params.mmc || false}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  mmc: e.target.checked || undefined,
                  direction: e.target.checked ? params.direction : undefined,
                })
              }
              size="small"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2">MMC</Typography>
              <Tooltip title="Make, Model, Color, Orientation, Year">
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={params.direction || false}
              onChange={(e) =>
                onParamsChange({ ...params, direction: e.target.checked || undefined })
              }
              size="small"
              disabled={!params.mmc}
            />
          }
          label={<Typography variant="body2">Direction</Typography>}
        />
      </Box>

      <Divider />

      {/* Engine Config */}
      <Typography variant="subtitle2" color="primary">
        Engine Config
      </Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Detection Mode</InputLabel>
          <Select
            value={config.detection_mode || 'plate'}
            label="Detection Mode"
            onChange={(e) =>
              updateConfig({
                detection_mode: e.target.value as EngineConfig['detection_mode'],
              })
            }
          >
            <MenuItem value="plate">plate (default)</MenuItem>
            <MenuItem value="vehicle">vehicle</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel>Speed Mode</InputLabel>
          <Select
            value={config.mode || ''}
            label="Speed Mode"
            onChange={(e) =>
              updateConfig({
                mode: (e.target.value as EngineConfig['mode']) || undefined,
              })
            }
          >
            <MenuItem value="">default</MenuItem>
            <MenuItem value="fast">fast (~30% faster)</MenuItem>
            <MenuItem value="redaction">redaction</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={config.detection_rule === 'strict'}
              onChange={(e) =>
                updateConfig({
                  detection_rule: e.target.checked ? 'strict' : undefined,
                })
              }
              size="small"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2">Detection Rule: Strict</Typography>
              <Tooltip title="Discard plates detected outside vehicles">
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </Box>
          }
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={config.region === 'strict'}
              onChange={(e) =>
                updateConfig({
                  region: e.target.checked ? 'strict' : undefined,
                })
              }
              size="small"
              disabled={!params.regions || params.regions.length === 0}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2">Region: Strict</Typography>
              <Tooltip title="Only accept exact region template matches (requires regions)">
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              </Tooltip>
            </Box>
          }
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          label="Threshold (detection)"
          value={config.threshold_d ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            updateConfig({
              threshold_d: val ? parseFloat(val) : undefined,
            });
          }}
          size="small"
          type="number"
          inputProps={{ min: 0, max: 1, step: 0.05 }}
          sx={{ flex: 1 }}
          helperText="dscore (0-1)"
          error={
            config.threshold_d !== undefined &&
            (config.threshold_d < 0 || config.threshold_d > 1)
          }
        />

        <TextField
          label="Threshold (OCR)"
          value={config.threshold_o ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            updateConfig({
              threshold_o: val ? parseFloat(val) : undefined,
            });
          }}
          size="small"
          type="number"
          inputProps={{ min: 0, max: 1, step: 0.05 }}
          sx={{ flex: 1 }}
          helperText="score (0-1)"
          error={
            config.threshold_o !== undefined &&
            (config.threshold_o < 0 || config.threshold_o > 1)
          }
        />
      </Box>
    </Box>
  );
};

export default ParametersForm;
