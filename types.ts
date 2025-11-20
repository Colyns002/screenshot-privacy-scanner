export enum RiskLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  SAFE = 'SAFE'
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface RiskItem {
  id: string;
  type: string;
  description: string;
  riskLevel: RiskLevel;
  box_2d?: BoundingBox | null; // Normalized 0-1000
  isHidden?: boolean; // If the user chooses to ignore this risk
  isRedacted?: boolean; // If the user has applied redaction
}

export interface AnalysisResult {
  risks: RiskItem[];
  summary: string;
}

export interface AppState {
  currentStep: 'UPLOAD' | 'ANALYZING' | 'REVIEW';
  imageUrl: string | null;
  imageBase64: string | null; // For sending to API
  analysisResult: AnalysisResult | null;
  error: string | null;
}