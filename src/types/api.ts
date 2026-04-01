// PlateRecognizer Snapshot API Types
// Based on: https://guides.platerecognizer.com/docs/snapshot/api-reference

// ============================================================
// REQUEST TYPES
// ============================================================

/** POST parameters for the Snapshot API */
export interface ApiParameters {
  regions?: string[];
  camera_id?: string;
  timestamp?: string;
  mmc?: boolean;
  direction?: boolean;
  config?: EngineConfig;
}

/** Engine configuration (sent as JSON string in the `config` field) */
export interface EngineConfig {
  mode?: 'fast' | 'redaction';
  detection_rule?: 'strict';
  detection_mode?: 'plate' | 'vehicle';
  region?: 'strict';
  threshold_d?: number;
  threshold_o?: number;
  text_formats?: string[];
  plates_per_vehicle?: number;
  zoom_in_vehicles?: number;
}

// ============================================================
// RESPONSE TYPES
// ============================================================

/** Top-level API response */
export interface SnapshotApiResponse {
  processing_time: number;
  results: PlateResult[];
  filename: string;
  version: number;
  camera_id: string | null;
  timestamp: string;
}

/** Individual plate detection result */
export interface PlateResult {
  box: BoundingBox;
  plate: string;
  region: RegionInfo;
  vehicle: VehicleInfo;
  score: number;
  candidates: PlateCandidate[];
  dscore: number;

  // Only when mmc=true
  model_make?: MakeModelEntry[];
  color?: ColorEntry[];
  orientation?: OrientationEntry[];

  // Only when mmc=true AND direction=true
  direction?: number;
  direction_score?: number;
}

/** Bounding box coordinates (pixels) */
export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/** Region detection info */
export interface RegionInfo {
  code: string;
  score: number;
}

/** Vehicle detection info */
export interface VehicleInfo {
  score: number;
  type: VehicleType;
  box: BoundingBox;
}

export type VehicleType =
  | 'Big Truck'
  | 'Bus'
  | 'Motorcycle'
  | 'Pickup Truck'
  | 'Sedan'
  | 'SUV'
  | 'Van'
  | 'Unknown';

/** Alternative plate prediction */
export interface PlateCandidate {
  score: number;
  plate: string;
}

/** Vehicle make/model prediction */
export interface MakeModelEntry {
  make: string;
  model: string;
  score: number;
}

/** Vehicle color prediction */
export interface ColorEntry {
  color: string;
  score: number;
}

/** Vehicle orientation prediction */
export interface OrientationEntry {
  orientation: 'Front' | 'Rear' | 'Unknown';
  score: number;
}

// ============================================================
// INTERNAL APP TYPES
// ============================================================

/** Image item in the processing queue */
export interface ImageItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  response?: SnapshotApiResponse;
  error?: string;
}

/** Connection configuration */
export interface ConnectionConfig {
  baseUrl: string;
  token: string;
}

/** Full form state */
export interface FormState {
  connection: ConnectionConfig;
  params: ApiParameters;
}
