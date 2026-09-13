export type NavView =
  | 'utility-dashboard'
  | 'camera-scanner'
  | 'exam-photo-sign-resizer'
  | 'passport-sheet-maker'
  | 'scheme-finder'
  | 'pdf-tools-compress'
  | 'qr-code-generator';

export type Language = 'EN' | 'HI';

export type ThemeMode = 'light' | 'dark';

export type ScanFilterMode = 'original' | 'magic-color' | 'doc-bw' | 'high-contrast' | 'grayscale';

export interface Point2D {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
}

export interface QuadCorners {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface ScannedDocumentPage {
  id: string;
  pageNumber: number;
  originalDataUrl: string;
  processedDataUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  filterMode: ScanFilterMode;
  brightness: number; // -50 to +50
  contrast: number; // -50 to +50
  corners: QuadCorners;
  isCropped: boolean;
  timestamp: number;
}

export interface ExamPreset {
  id: string;
  name: string;
  category: 'ssc' | 'upsc' | 'ibps' | 'rrb' | 'nta' | 'state';
  photo: {
    minKb: number;
    maxKb: number;
    idealKb: number;
    widthPx: number;
    heightPx: number;
    widthCm: number;
    heightCm: number;
    dpi: number;
    format: 'image/jpeg';
    requiresDOP: boolean;
    dopNotes: string;
    aspectRatio: string;
  };
  signature: {
    minKb: number;
    maxKb: number;
    idealKb: number;
    widthPx: number;
    heightPx: number;
    widthCm: number;
    heightCm: number;
    dpi: number;
    format: 'image/jpeg';
    aspectRatio: string;
    inkColor: 'black' | 'blue' | 'any';
  };
  allowedFormats: string[];
  whiteBgRequired: boolean;
  notes: string;
}

export interface SchemeItem {
  id: string;
  title: string;
  category: string;
  department: string;
  type: 'scholarship' | 'financial' | 'gadgets' | 'health' | 'housing' | 'business' | 'skill' | 'pension';
  state: string; // 'ALL' or specific state like 'UP', 'BIHAR', 'MAHARASHTRA', 'MP', 'RAJASTHAN', 'WB', 'KARNATAKA', 'TN', 'DELHI', etc.
  stateName?: string;
  matchPercentage: number;
  matchScore: number;
  matchReason: string;
  financialBenefit: string;
  benefitSubtitle: string;
  benefitType: 'cash' | 'hardware' | 'waiver' | 'insurance' | 'loan';
  minIncomeCap: number; // in INR
  eligibleCategories: ('General' | 'OBC-NCL' | 'EWS' | 'SC' | 'ST' | 'Minority')[];
  eligibleEducations: ('UG' | 'PG' | '12TH' | 'DIPLOMA' | 'SELF_EMP' | 'ANY')[];
  deadline: string;
  portalUrl: string;
  portalName: string;
  mandatoryDocuments: {
    name: string;
    ready: boolean;
    status: 'verified' | 'pending' | 'required';
  }[];
  requiresAadhaarDbT: boolean;
  requiresFarmerFamily?: boolean;
  requiresGirlChild?: boolean;
  requiresPwd?: boolean;
  requiresMinority?: boolean;
  requiresFirstGenLearner?: boolean;
  targetAudience?: string;
}

export type SheetFormat = '4x6' | 'a4-16' | 'a4-32';
export type StampStyle = 'boxed' | 'semi';
export type PrinterMargin = 'lab' | 'home';

export interface ResizerConfig {
  mode: 'photo' | 'signature';
  presetId: string;
  zoom: number;
  rotation: number;
  panX: number;
  panY: number;
  addDop: boolean;
  candidateName: string;
  dateOfPhoto: string;
  quality: number; // 40-98
  autoTargetKb: boolean;
  targetKb: number;
  applyWhitener: boolean;
}

export interface GlobalLoadingTask {
  active: boolean;
  label: string;
  progress: number; // 0 to 100
  statusText?: string;
  stage?: string;
}

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  originalSizeKb: number;
  previewUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  resultBlob?: Blob;
  resultSizeKb?: number;
  resultUrl?: string;
  error?: string;
  progress?: number;
}

export interface TaskManager {
  startTask: (label: string, initialProgress?: number, statusText?: string) => void;
  updateProgress: (progress: number, statusText?: string) => void;
  completeTask: (finalStatus?: string, delayMs?: number) => void;
  cancelTask: () => void;
  isLoading: boolean;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export type ProcessCategory =
  | 'photo-resizer'
  | 'signature-resizer'
  | 'passport-maker'
  | 'camera-scanner'
  | 'pdf-compress'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-docx'
  | 'docx-pdf'
  | 'img-pdf'
  | 'pdf-img'
  | 'digital-sign'
  | 'ocr';

export interface ProcessedFileRecord {
  id: string;
  timestamp: number;
  fileName: string;
  category: ProcessCategory;
  fileType: 'image' | 'pdf' | 'docx' | 'zip';
  sizeKb: number;
  originalSizeKb?: number;
  details: string; // e.g. "SSC 20-50KB • 200 DPI", "Flate Compressed < 100KB", "4-Page Scanned PDF"
  downloadUrl?: string; // object URL or data URL
  dataUrl?: string; // backup data URL for persistent re-downloads across tab refreshes
}
