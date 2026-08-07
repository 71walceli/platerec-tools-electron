import {
  ApiParameters,
  BoundingBox,
  EngineConfig,
  OrientationEntry,
  PlateCandidate,
  SnapshotApiResponse,
  VehicleType,
} from '../types/api';

export interface AnalyzeImageOptions {
  baseUrl: string;
  token?: string;
  imageFile?: File;
  imageDataUrl?: string;
  params: ApiParameters;
}

export interface AnalyzeImageResult {
  rawResponse: unknown;
  normalizedResponse: SnapshotApiResponse;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSnapshotCloudUrl(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname === 'api.platerecognizer.com';
  } catch {
    return false;
  }
}

function shouldRetry(status: number | null): boolean {
  if (status === null) return true; // network / fetch failures
  if (status === 429) return true; // rate limited
  if (status >= 500) return true; // transient server issues
  return false;
}

/**
 * Return a filename safe for clients and servers that only support ASCII.
 * Keep the original File untouched because it is also used by the UI/export flow.
 */
export function normalizeFilenameForUpload(filename: string): string {
  const asciiFilename = filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/gu, '_');

  return asciiFilename || 'upload';
}

type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ApiRecord
    : {};
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeBox(value: unknown): BoundingBox {
  const box = asRecord(value);
  return {
    xmin: numberValue(box.xmin),
    ymin: numberValue(box.ymin),
    xmax: numberValue(box.xmax),
    ymax: numberValue(box.ymax),
  };
}

function normalizeCandidates(value: unknown): PlateCandidate[] {
  if (!Array.isArray(value)) return [];

  return value.map((rawCandidate) => {
    const candidate = asRecord(rawCandidate);
    return {
      plate: stringValue(candidate.plate, '-No plate-'),
      score: numberValue(candidate.score),
    };
  });
}

function normalizeVehicleType(value: unknown): VehicleType {
  const vehicleTypes: VehicleType[] = [
    'Big Truck', 'Bus', 'Motorcycle', 'Pickup Truck', 'Sedan', 'SUV', 'Van', 'Unknown',
  ];
  return typeof value === 'string' && vehicleTypes.includes(value as VehicleType)
    ? value as VehicleType
    : 'Unknown';
}

function normalizeOrientation(value: unknown): OrientationEntry['orientation'] {
  return value === 'Front' || value === 'Rear' || value === 'Unknown' ? value : 'Unknown';
}

function normalizeSnapshotResponse(raw: unknown): SnapshotApiResponse {
  const response = asRecord(raw);
  const rawResults = Array.isArray(response.results) ? response.results : [];

  const results = rawResults.map((rawItem) => {
    const item = asRecord(rawItem);
    const plate = item.plate;
    const isVehicleModeShape =
      plate === null || (asRecord(plate).box !== undefined);

    // Default / plate mode shape (already normalized)
    if (!isVehicleModeShape) {
      const vehicle = asRecord(item.vehicle);
      return {
        plate: stringValue(plate, '-No plate-'),
        box: normalizeBox(item.box),
        region: {
          code: stringValue(asRecord(item.region).code, 'unknown'),
          score: numberValue(asRecord(item.region).score),
        },
        vehicle: {
          type: normalizeVehicleType(vehicle.type),
          score: numberValue(vehicle.score),
          box: normalizeBox(vehicle.box),
        },
        score: numberValue(item.score),
        dscore: numberValue(item.dscore),
        candidates: normalizeCandidates(item.candidates),
      };
    }

    // Vehicle mode shape
    const plateObj = asRecord(plate);
    const vehicleObj = asRecord(item.vehicle);
    const plateProps = asRecord(plateObj.props);
    const vehicleProps = asRecord(vehicleObj.props);

    const plateCandidates = Array.isArray(plateProps.plate)
      ? plateProps.plate.map((rawCandidate) => {
        const candidate = asRecord(rawCandidate);
        return {
          plate: stringValue(candidate.value, '-No plate-'),
          score: numberValue(candidate.score),
        };
      })
      : [];

    const bestCandidate = plateCandidates[0];

    const regionCandidate = Array.isArray(plateProps.region)
      ? asRecord(plateProps.region[0])
      : {};

    return {
      plate: bestCandidate?.plate ?? '-No plate-',
      score:
        typeof bestCandidate?.score === 'number'
          ? bestCandidate.score
          : typeof plateObj.score === 'number'
            ? plateObj.score
            : 0,
      dscore: numberValue(plateObj.score),
      box: normalizeBox(plateObj.box),
      candidates: plateCandidates,
      region: {
        code: stringValue(regionCandidate.value, 'unknown'),
        score: numberValue(regionCandidate.score),
      },
      vehicle: {
        type: normalizeVehicleType(vehicleObj.type),
        score: numberValue(vehicleObj.score),
        box: normalizeBox(vehicleObj.box),
      },
      model_make: Array.isArray(vehicleProps.make_model)
        ? vehicleProps.make_model.map((rawModel) => {
          const model = asRecord(rawModel);
          return {
            make: stringValue(model.make, 'Unknown'),
            model: stringValue(model.model, 'Unknown'),
            score: numberValue(model.score),
          };
        })
        : undefined,
      color: Array.isArray(vehicleProps.color)
        ? vehicleProps.color.map((rawColor) => {
          const color = asRecord(rawColor);
          return {
            color: stringValue(color.value, stringValue(color.color, 'unknown')),
            score: numberValue(color.score),
          };
        })
        : undefined,
      orientation: Array.isArray(vehicleProps.orientation)
        ? vehicleProps.orientation.map((rawOrientation) => {
          const orientation = asRecord(rawOrientation);
          return {
            orientation: normalizeOrientation(orientation.value ?? orientation.orientation),
            score: numberValue(orientation.score),
          };
        })
        : undefined,
      direction: typeof item.direction === 'number' ? item.direction : undefined,
      direction_score:
        typeof item.direction_score === 'number' ? item.direction_score : undefined,
    };
  });

  return {
    processing_time:
      numberValue(response.processing_time),
    results,
    filename: stringValue(response.filename, 'unknown'),
    version: numberValue(response.version, 1),
    camera_id: typeof response.camera_id === 'string' ? response.camera_id : null,
    timestamp: stringValue(response.timestamp, new Date().toISOString()),
  };
}

/**
 * Send an image to the PlateRecognizer Snapshot API.
 * Supports both File objects and base64 data URLs.
 */
export async function analyzeImage(options: AnalyzeImageOptions): Promise<AnalyzeImageResult> {
  const { baseUrl, token, imageFile, imageDataUrl, params } = options;

  // Build headers once
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const isSnapshotCloud = isSnapshotCloudUrl(baseUrl);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();

      // Add image
      if (imageFile) {
        formData.append('upload', imageFile, normalizeFilenameForUpload(imageFile.name));
      } else if (imageDataUrl) {
        // Convert data URL to blob
        const response = await fetch(imageDataUrl);
        const blob = await response.blob();
        formData.append('upload', blob, 'image.jpg');
      } else {
        // TODO Allow for URLs, in which case, they'd be added as upload_url fields.
        throw new Error('Either imageFile or imageDataUrl must be provided');
      }

      // Add regions (multiple -F regions= style)
      if (params.regions && params.regions.length > 0) {
        params.regions.forEach((region) => {
          formData.append('regions', region);
        });
      }

      // Add simple parameters
      if (params.camera_id) {
        formData.append('camera_id', params.camera_id);
      }
      if (params.timestamp) {
        formData.append('timestamp', params.timestamp);
      }
      if (params.mmc !== undefined) {
        formData.append('mmc', String(params.mmc));
      }
      if (params.direction !== undefined) {
        formData.append('direction', String(params.direction));
      }

      // Add config as JSON string
      if (params.config) {
        const configObj: Record<string, unknown> = {};
        const cfg = params.config;

        if (cfg.mode) configObj.mode = cfg.mode;
        if (cfg.detection_rule) configObj.detection_rule = cfg.detection_rule;
        if (cfg.detection_mode) configObj.detection_mode = cfg.detection_mode;
        if (cfg.region) configObj.region = cfg.region;
        if (cfg.threshold_d !== undefined) configObj.threshold_d = cfg.threshold_d;
        if (cfg.threshold_o !== undefined) configObj.threshold_o = cfg.threshold_o;
        if (cfg.text_formats && cfg.text_formats.length > 0) configObj.text_formats = cfg.text_formats;
        if (cfg.plates_per_vehicle !== undefined) configObj.plates_per_vehicle = cfg.plates_per_vehicle;
        if (cfg.zoom_in_vehicles !== undefined) configObj.zoom_in_vehicles = cfg.zoom_in_vehicles;

        if (Object.keys(configObj).length > 0) {
          formData.append('config', JSON.stringify(configObj));
        }
      }

      const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const errorText = await res.text();

        if (attempt < MAX_RETRIES && shouldRetry(res.status)) {
          const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;

          // Snapshot Cloud free plan allows 1 req/sec; on 429 we always wait before retrying.
          // Applies to cloud endpoint only, but harmless elsewhere.
          if (!isSnapshotCloud || res.status === 429 || res.status >= 500) {
            await delay(backoff);
            continue;
          }
        }

        throw new Error(`API error ${res.status}: ${errorText}`);
      }

      const rawJson = await res.json();
      return {
        rawResponse: rawJson,
        normalizedResponse: normalizeSnapshotResponse(rawJson),
      };
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const message = error instanceof Error ? error.message : String(error);
        const isLikelyNetworkError =
          message.includes('Failed to fetch') ||
          message.includes('NetworkError');

        if (isLikelyNetworkError) {
          const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;
          await delay(backoff);
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error('API request failed after maximum retry attempts');
}

/**
 * Build a config object from individual form fields, omitting undefined/empty values.
 */
export function buildEngineConfig(fields: Partial<EngineConfig>): EngineConfig | undefined {
  const config: EngineConfig = {};
  let hasValue = false;

  if (fields.mode) { config.mode = fields.mode; hasValue = true; }
  if (fields.detection_rule) { config.detection_rule = fields.detection_rule; hasValue = true; }
  if (fields.detection_mode && fields.detection_mode !== 'plate') {
    config.detection_mode = fields.detection_mode; hasValue = true;
  }
  if (fields.region) { config.region = fields.region; hasValue = true; }
  if (fields.threshold_d !== undefined && fields.threshold_d !== null) {
    config.threshold_d = fields.threshold_d; hasValue = true;
  }
  if (fields.threshold_o !== undefined && fields.threshold_o !== null) {
    config.threshold_o = fields.threshold_o; hasValue = true;
  }
  if (fields.text_formats && fields.text_formats.length > 0) {
    config.text_formats = fields.text_formats; hasValue = true;
  }
  if (fields.plates_per_vehicle !== undefined && fields.plates_per_vehicle !== 1) {
    config.plates_per_vehicle = fields.plates_per_vehicle; hasValue = true;
  }
  if (fields.zoom_in_vehicles !== undefined && fields.zoom_in_vehicles !== 4) {
    config.zoom_in_vehicles = fields.zoom_in_vehicles; hasValue = true;
  }

  return hasValue ? config : undefined;
}
