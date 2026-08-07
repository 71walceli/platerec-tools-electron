import { PlateResult, SnapshotApiResponse, ImageItem } from '../types/api';

/**
 * FLAT CSV columns matching the reference format:
 * filename, timestamp, camera_id, processing_time, box_xmin, box_ymin, box_xmax, box_ymax,
 * plate, region_code, region_score, score, candidates, dscore, vehicle_score,
 * vehicle_type, vehicle_box_xmin, vehicle_box_ymin, vehicle_box_xmax, vehicle_box_ymax,
 * model_make, color, orientation, direction, direction_score
 */

const CSV_HEADERS = [
  'filename',
  'timestamp',
  'camera_id',
  'processing_time',
  'box_xmin',
  'box_ymin',
  'box_xmax',
  'box_ymax',
  'plate',
  'region_code',
  'region_score',
  'score',
  'candidates',
  'dscore',
  'vehicle_score',
  'vehicle_type',
  'vehicle_box_xmin',
  'vehicle_box_ymin',
  'vehicle_box_xmax',
  'vehicle_box_ymax',
  'model_make',
  'color',
  'orientation',
  'direction',
  'direction_score',
] as const;

function escapeCsvValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // If the value contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert a single image's API response into CSV rows (one row per plate result).
 */
export function imageItemToCsvRows(item: ImageItem): string[][] {
  if (!item.response) return [];

  const response: SnapshotApiResponse = item.response;
  const filename = item.file.name;

  return response.results.map((result: PlateResult) => {
    return [
      // filename
      escapeCsvValue(filename),
      // timestamp
      escapeCsvValue(response.timestamp || ''),
      // camera_id
      escapeCsvValue(response.camera_id || ''),
      // processing_time
      escapeCsvValue(response.processing_time),
      // box
      escapeCsvValue(result.box.xmin),
      escapeCsvValue(result.box.ymin),
      escapeCsvValue(result.box.xmax),
      escapeCsvValue(result.box.ymax),
      // plate
      escapeCsvValue(result.plate),
      // region
      escapeCsvValue(result.region.code),
      escapeCsvValue(result.region.score),
      // score
      escapeCsvValue(result.score),
      // candidates
      escapeCsvValue(result.candidates),
      // dscore
      escapeCsvValue(result.dscore),
      // vehicle score
      escapeCsvValue(result.vehicle.score),
      // vehicle
      escapeCsvValue(result.vehicle.type),
      escapeCsvValue(result.vehicle.box.xmin),
      escapeCsvValue(result.vehicle.box.ymin),
      escapeCsvValue(result.vehicle.box.xmax),
      escapeCsvValue(result.vehicle.box.ymax),
      // model_make
      escapeCsvValue(result.model_make || []),
      // color
      escapeCsvValue(result.color || []),
      // orientation
      escapeCsvValue(result.orientation || []),
      // direction
      escapeCsvValue(result.direction ?? ''),
      // direction_score
      escapeCsvValue(result.direction_score ?? ''),
    ];
  });
}

/**
 * Convert all completed image items into a full CSV string.
 */
export function buildCsvFromImages(items: ImageItem[]): string {
  const completedItems = items.filter(
    (item) => item.status === 'complete' && item.response
  );

  if (completedItems.length === 0) {
    return '';
  }

  const headerRow = CSV_HEADERS.join(',');
  const allRows = completedItems.flatMap(imageItemToCsvRows);
  const dataRows = allRows.map((row) => row.join(','));

  return [headerRow, ...dataRows].join('\n');
}
