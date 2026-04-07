import { ApiParameters, EngineConfig, SnapshotApiResponse } from '../types/api';

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

function emptyBox() {
  return { xmin: 0, ymin: 0, xmax: 0, ymax: 0 };
}

function normalizeSnapshotResponse(raw: any): SnapshotApiResponse {
  const rawResults = Array.isArray(raw?.results) ? raw.results : [];

  const results = rawResults.map((item: any) => {
    const isVehicleModeShape =
      item &&
      (item.plate === null || (typeof item.plate === 'object' && item.plate?.box));

    // Default / plate mode shape (already normalized)
    if (!isVehicleModeShape) {
      return {
        ...item,
        plate: item?.plate || '-No plate-',
        box: item?.box || emptyBox(),
        region: item?.region || { code: 'unknown', score: 0 },
        vehicle: item?.vehicle || { type: 'Unknown', score: 0, box: emptyBox() },
        score: typeof item?.score === 'number' ? item.score : 0,
        dscore: typeof item?.dscore === 'number' ? item.dscore : 0,
        candidates: Array.isArray(item?.candidates) ? item.candidates : [],
      };
    }

    // Vehicle mode shape
    const plateObj = item?.plate;
    const vehicleObj = item?.vehicle || {};

    const plateCandidates = Array.isArray(plateObj?.props?.plate)
      ? plateObj.props.plate.map((p: any) => ({
        plate: p?.value ?? '-No plate-',
        score: typeof p?.score === 'number' ? p.score : 0,
      }))
      : [];

    const bestCandidate = plateCandidates[0];

    const regionCandidate = Array.isArray(plateObj?.props?.region)
      ? plateObj.props.region[0]
      : null;

    return {
      plate: bestCandidate?.plate ?? '-No plate-',
      score:
        typeof bestCandidate?.score === 'number'
          ? bestCandidate.score
          : typeof plateObj?.score === 'number'
            ? plateObj.score
            : 0,
      dscore: typeof plateObj?.score === 'number' ? plateObj.score : 0,
      box: plateObj?.box || emptyBox(),
      candidates: plateCandidates,
      region: {
        code: regionCandidate?.value ?? 'unknown',
        score: typeof regionCandidate?.score === 'number' ? regionCandidate.score : 0,
      },
      vehicle: {
        type: vehicleObj?.type ?? 'Unknown',
        score: typeof vehicleObj?.score === 'number' ? vehicleObj.score : 0,
        box: vehicleObj?.box || emptyBox(),
      },
      model_make: Array.isArray(vehicleObj?.props?.make_model)
        ? vehicleObj.props.make_model.map((m: any) => ({
          make: m?.make ?? 'Unknown',
          model: m?.model ?? 'Unknown',
          score: typeof m?.score === 'number' ? m.score : 0,
        }))
        : undefined,
      color: Array.isArray(vehicleObj?.props?.color)
        ? vehicleObj.props.color.map((c: any) => ({
          color: c?.value ?? c?.color ?? 'unknown',
          score: typeof c?.score === 'number' ? c.score : 0,
        }))
        : undefined,
      orientation: Array.isArray(vehicleObj?.props?.orientation)
        ? vehicleObj.props.orientation.map((o: any) => ({
          orientation: o?.value ?? o?.orientation ?? 'Unknown',
          score: typeof o?.score === 'number' ? o.score : 0,
        }))
        : undefined,
      direction: typeof item?.direction === 'number' ? item.direction : undefined,
      direction_score:
        typeof item?.direction_score === 'number' ? item.direction_score : undefined,
    };
  });

  return {
    processing_time:
      typeof raw?.processing_time === 'number' ? raw.processing_time : 0,
    results,
    filename: raw?.filename ?? 'unknown',
    version: typeof raw?.version === 'number' ? raw.version : 1,
    camera_id: raw?.camera_id ?? null,
    timestamp: raw?.timestamp ?? new Date().toISOString(),
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
        formData.append('upload', imageFile);
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
