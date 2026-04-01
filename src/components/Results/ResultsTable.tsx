import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
} from '@mui/material';
import { PlateResult } from '../../types/api';

interface ResultsTableProps {
  results: PlateResult[];
}

function formatBox(box: { xmin: number; ymin: number; xmax: number; ymax: number }): string {
  return `(${box.xmin}, ${box.ymin}) → (${box.xmax}, ${box.ymax})`;
}

function getScoreColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 0.9) return 'success';
  if (score >= 0.7) return 'warning';
  return 'error';
}

const ResultsTable: React.FC<ResultsTableProps> = ({ results }) => {
  if (!results || results.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
        No results yet. Upload an image and click Analyze.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell><strong>Plate</strong></TableCell>
            <TableCell align="right"><strong>Score</strong></TableCell>
            <TableCell align="right"><strong>DScore</strong></TableCell>
            <TableCell><strong>Region</strong></TableCell>
            <TableCell><strong>Vehicle</strong></TableCell>
            <TableCell><strong>Box</strong></TableCell>
            <TableCell><strong>Candidates</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result, idx) => (
            <TableRow key={idx} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                  {result.plate.toUpperCase()}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Chip
                  label={result.score.toFixed(3)}
                  size="small"
                  color={getScoreColor(result.score)}
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="right">
                <Chip
                  label={result.dscore.toFixed(3)}
                  size="small"
                  color={getScoreColor(result.dscore)}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Typography variant="caption">
                  {result.region.code} ({(result.region.score * 100).toFixed(0)}%)
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">
                  {result.vehicle.type}
                  {result.vehicle.score > 0 && ` (${(result.vehicle.score * 100).toFixed(0)}%)`}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" fontFamily="monospace">
                  {formatBox(result.box)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption">
                  {result.candidates.slice(0, 3).map((c) => c.plate).join(', ')}
                  {result.candidates.length > 3 && '...'}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ResultsTable;
