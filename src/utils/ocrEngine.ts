import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// Ensure PDF.js worker is properly configured
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  words: OcrWord[];
}

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  lines: OcrLine[];
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  detectedOrientation?: 0 | 90 | 180 | 270;
  autoRotated?: boolean;
  orientationConfidence?: number;
  orientationLabel?: string;
  rotationApplied?: number;
}

export interface OcrProgressInfo {
  status: string;
  progress: number;
  currentPage: number;
  totalPages: number;
  currentStage: string;
}

export interface ExtractedGovtEntity {
  label: string;
  value: string;
  category: 'id' | 'date' | 'contact' | 'score' | 'general';
  confidence?: number;
}

/**
 * Rotate a Canvas by a specific angle (0, 90, 180, 270 degrees clockwise)
 */
export function rotateCanvas(
  sourceCanvas: HTMLCanvasElement,
  degrees: number
): HTMLCanvasElement {
  const normDegrees = ((degrees % 360) + 360) % 360;
  if (normDegrees === 0) return sourceCanvas;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  if (normDegrees === 90 || normDegrees === 270) {
    canvas.width = sourceCanvas.height;
    canvas.height = sourceCanvas.width;
  } else {
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
  }

  ctx.save();
  if (normDegrees === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate((90 * Math.PI) / 180);
  } else if (normDegrees === 180) {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate((180 * Math.PI) / 180);
  } else if (normDegrees === 270) {
    ctx.translate(0, canvas.height);
    ctx.rotate((270 * Math.PI) / 180);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return canvas;
}

/**
 * Analyze Document Text Layout using Projection Profile Variance.
 * In a standard upright document with horizontal text lines, the row-wise variance
 * (horizontal projection profile of dark text on light background) exhibits high periodic energy
 * due to alternating text lines and white line gaps, whereas the column-wise profile is smooth.
 * If text is rotated 90° or 270° (sideways), column-wise variance dominates row-wise variance.
 */
export function analyzeLayoutProjectionProfile(canvas: HTMLCanvasElement): {
  isLikelySideways: boolean;
  horizontalVariance: number;
  verticalVariance: number;
  ratio: number;
  confidence: number;
} {
  const sampleW = 400;
  const sampleH = Math.max(100, Math.round((canvas.height / canvas.width) * sampleW));
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleW;
  sampleCanvas.height = sampleH;
  const ctx = sampleCanvas.getContext('2d');
  if (!ctx) {
    return { isLikelySideways: false, horizontalVariance: 1, verticalVariance: 1, ratio: 1, confidence: 0 };
  }

  ctx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  const rowSums = new Float64Array(sampleH);
  const colSums = new Float64Array(sampleW);

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const idx = (y * sampleW + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const darkIntensity = 255 - gray;
      if (darkIntensity > 45) {
        rowSums[y] += darkIntensity;
        colSums[x] += darkIntensity;
      }
    }
  }

  let rowDiffVar = 0;
  let rowMean = 0;
  for (let y = 1; y < sampleH; y++) {
    const diff = Math.abs(rowSums[y] - rowSums[y - 1]);
    rowMean += diff;
  }
  rowMean /= Math.max(1, sampleH - 1);
  for (let y = 1; y < sampleH; y++) {
    const diff = Math.abs(rowSums[y] - rowSums[y - 1]);
    rowDiffVar += (diff - rowMean) * (diff - rowMean);
  }
  rowDiffVar /= Math.max(1, sampleH - 1);

  let colDiffVar = 0;
  let colMean = 0;
  for (let x = 1; x < sampleW; x++) {
    const diff = Math.abs(colSums[x] - colSums[x - 1]);
    colMean += diff;
  }
  colMean /= Math.max(1, sampleW - 1);
  for (let x = 1; x < sampleW; x++) {
    const diff = Math.abs(colSums[x] - colSums[x - 1]);
    colDiffVar += (diff - colMean) * (diff - colMean);
  }
  colDiffVar /= Math.max(1, sampleW - 1);

  const normRowVar = rowDiffVar / (sampleW * sampleW || 1);
  const normColVar = colDiffVar / (sampleH * sampleH || 1);
  const ratio = (normRowVar + 1e-5) / (normColVar + 1e-5);

  const isLikelySideways = ratio < 0.75;
  const confidence = isLikelySideways
    ? Math.min(96, Math.round((1 - ratio) * 110 + 40))
    : Math.min(96, Math.round((ratio - 1) * 60 + 55));

  return {
    isLikelySideways,
    horizontalVariance: normRowVar,
    verticalVariance: normColVar,
    ratio,
    confidence,
  };
}

/**
 * Detect Document Orientation Angle using Optical Script & Layout Analysis
 */
export async function detectDocumentOrientation(
  canvas: HTMLCanvasElement,
  worker?: any
): Promise<{
  detectedAngle: 0 | 90 | 180 | 270;
  confidence: number;
  orientationLabel: string;
  isRotated: boolean;
}> {
  try {
    // 1. First probe using Tesseract OSD if supported by worker
    if (worker && typeof worker.detect === 'function') {
      try {
        const maxDim = 1000;
        let osdCanvas = canvas;
        if (canvas.width > maxDim || canvas.height > maxDim) {
          const scale = maxDim / Math.max(canvas.width, canvas.height);
          osdCanvas = document.createElement('canvas');
          osdCanvas.width = Math.round(canvas.width * scale);
          osdCanvas.height = Math.round(canvas.height * scale);
          const ctx = osdCanvas.getContext('2d');
          ctx?.drawImage(canvas, 0, 0, osdCanvas.width, osdCanvas.height);
        }

        const osdDataUrl = osdCanvas.toDataURL('image/jpeg', 0.85);
        const detectPromise = worker.detect(osdDataUrl);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OSD timeout')), 3000)
        );

        const detectResult: any = await Promise.race([detectPromise, timeoutPromise]);

        if (detectResult && detectResult.data) {
          const rawAngle = detectResult.data.orientation_degrees;
          const conf = Math.round(detectResult.data.orientation_confidence || 85);

          if (rawAngle === 90 || rawAngle === 180 || rawAngle === 270) {
            return {
              detectedAngle: rawAngle as 90 | 180 | 270,
              confidence: Math.max(50, Math.min(99, conf)),
              orientationLabel: `Rotated ${rawAngle}° Clockwise (AI OSD Detected)`,
              isRotated: true,
            };
          } else if (rawAngle === 0) {
            return {
              detectedAngle: 0,
              confidence: Math.max(70, Math.min(99, conf)),
              orientationLabel: 'Upright 0° (AI Verified)',
              isRotated: false,
            };
          }
        }
      } catch {
        // Fallback to layout projection profile
      }
    }

    // 2. Optical Layout Text Line Profile Flow Analysis
    const profile = analyzeLayoutProjectionProfile(canvas);
    if (profile.isLikelySideways) {
      return {
        detectedAngle: 90,
        confidence: Math.max(65, Math.min(92, profile.confidence)),
        orientationLabel: 'Sideways 90° (Text Flow Layout Analysis)',
        isRotated: true,
      };
    }

    return {
      detectedAngle: 0,
      confidence: Math.max(70, Math.min(95, profile.confidence)),
      orientationLabel: 'Upright 0° (Text Line Profile Aligned)',
      isRotated: false,
    };
  } catch {
    return {
      detectedAngle: 0,
      confidence: 50,
      orientationLabel: 'Default 0° Alignment',
      isRotated: false,
    };
  }
}

/**
 * Analyzes document orientation and automatically produces an upright canvas
 */
export async function autoOrientDocumentCanvas(
  canvas: HTMLCanvasElement,
  worker?: any
): Promise<{
  canvas: HTMLCanvasElement;
  detectedAngle: 0 | 90 | 180 | 270;
  isRotated: boolean;
  confidence: number;
  orientationLabel: string;
}> {
  const orientation = await detectDocumentOrientation(canvas, worker);

  if (orientation.isRotated && orientation.detectedAngle !== 0) {
    // If the image is detected rotated clockwise by `detectedAngle`,
    // rotating it by (360 - detectedAngle) % 360 restores upright orientation.
    const correctionAngle = (360 - orientation.detectedAngle) % 360;
    const correctedCanvas = rotateCanvas(canvas, correctionAngle);

    return {
      canvas: correctedCanvas,
      detectedAngle: orientation.detectedAngle,
      isRotated: true,
      confidence: orientation.confidence,
      orientationLabel: orientation.orientationLabel,
    };
  }

  return {
    canvas,
    detectedAngle: 0,
    isRotated: false,
    confidence: orientation.confidence,
    orientationLabel: orientation.orientationLabel,
  };
}

/**
 * Preprocess an image canvas for optimal OCR accuracy
 */
export function preprocessImageForOcr(
  sourceCanvas: HTMLCanvasElement,
  options: {
    enhanceContrast?: boolean;
    grayscale?: boolean;
    threshold?: boolean;
    thresholdValue?: number;
  } = {}
): HTMLCanvasElement {
  const { enhanceContrast = true, grayscale = true, threshold = false, thresholdValue = 128 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);

  if (!grayscale && !enhanceContrast && !threshold) {
    return canvas;
  }

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Grayscale and contrast calculation
  const contrastFactor = 1.25; // 25% contrast enhancement

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Standard Luminance Formula
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    if (enhanceContrast) {
      gray = Math.min(255, Math.max(0, contrastFactor * (gray - 128) + 128));
    }

    if (threshold) {
      gray = gray >= thresholdValue ? 255 : 0;
    }

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Run OCR on a single Image file or DataURL with optional Auto-Orientation Detection
 */
export async function performImageOcr(
  imageSource: string | File | HTMLCanvasElement,
  language: string = 'eng',
  onProgress?: (info: OcrProgressInfo) => void,
  preprocess: boolean = true,
  autoOrient: boolean = true,
  manualRotation: number = 0
): Promise<OcrPageResult> {
  onProgress?.({
    status: 'Initializing OCR Engine',
    progress: 0.08,
    currentPage: 1,
    totalPages: 1,
    currentStage: 'Loading AI language models...',
  });

  // Prepare canvas/image
  let canvas: HTMLCanvasElement;
  let originalDataUrl: string;

  if (imageSource instanceof HTMLCanvasElement) {
    canvas = imageSource;
    originalDataUrl = canvas.toDataURL('image/png');
  } else if (typeof imageSource === 'string') {
    originalDataUrl = imageSource;
    canvas = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = imageSource;
    });
  } else {
    // File
    originalDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    });
    canvas = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = originalDataUrl;
    });
  }

  // Apply manual pre-rotation if requested
  if (manualRotation !== 0) {
    canvas = rotateCanvas(canvas, manualRotation);
  }

  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.({
          status: 'Recognizing Document Characters',
          progress: 0.25 + (m.progress || 0) * 0.7,
          currentPage: 1,
          totalPages: 1,
          currentStage: `Analyzing text patterns (${Math.round((m.progress || 0) * 100)}%)...`,
        });
      } else if (m.status.includes('loading')) {
        onProgress?.({
          status: 'Loading Language Models',
          progress: 0.15,
          currentPage: 1,
          totalPages: 1,
          currentStage: m.status,
        });
      }
    },
  });

  try {
    let detectedOrientation: 0 | 90 | 180 | 270 = 0;
    let autoRotated = false;
    let orientationConfidence = 95;
    let orientationLabel = 'Upright 0°';

    // Auto-Orientation Detection & Upright Alignment
    if (autoOrient && manualRotation === 0) {
      onProgress?.({
        status: 'Auto-Detecting Layout Orientation',
        progress: 0.2,
        currentPage: 1,
        totalPages: 1,
        currentStage: 'Analyzing text line layout & checking rotation alignment...',
      });

      const orientResult = await autoOrientDocumentCanvas(canvas, worker);
      canvas = orientResult.canvas;
      detectedOrientation = orientResult.detectedAngle;
      autoRotated = orientResult.isRotated;
      orientationConfidence = orientResult.confidence;
      orientationLabel = orientResult.orientationLabel;

      if (autoRotated) {
        onProgress?.({
          status: 'Orientation Corrected',
          progress: 0.24,
          currentPage: 1,
          totalPages: 1,
          currentStage: `Auto-aligned document (${orientationLabel}). Extracting characters...`,
        });
      }
    }

    const processedCanvas = preprocess ? preprocessImageForOcr(canvas) : canvas;
    const ocrInputUrl = processedCanvas.toDataURL('image/png');
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    const result = await worker.recognize(ocrInputUrl);
    const data = result.data as any;
    const rawLines = data.lines || data.blocks?.flatMap((b: any) => b.paragraphs?.flatMap((p: any) => p.lines)) || [];

    const lines: OcrLine[] = rawLines.map((l: any) => ({
      text: (l.text || '').trim(),
      confidence: Math.round(l.confidence || 0),
      bbox: {
        x0: l.bbox?.x0 || 0,
        y0: l.bbox?.y0 || 0,
        x1: l.bbox?.x1 || 0,
        y1: l.bbox?.y1 || 0,
      },
      words: (l.words || []).map((w: any) => ({
        text: (w.text || '').trim(),
        confidence: Math.round(w.confidence || 0),
        bbox: {
          x0: w.bbox?.x0 || 0,
          y0: w.bbox?.y0 || 0,
          x1: w.bbox?.x1 || 0,
          y1: w.bbox?.y1 || 0,
        },
      })),
    }));

    onProgress?.({
      status: 'OCR Completed',
      progress: 1.0,
      currentPage: 1,
      totalPages: 1,
      currentStage: 'Document characters extracted successfully.',
    });

    return {
      pageNumber: 1,
      text: data.text.trim(),
      confidence: Math.round(data.confidence),
      lines,
      imageDataUrl: finalDataUrl,
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      detectedOrientation,
      autoRotated,
      orientationConfidence,
      orientationLabel,
      rotationApplied: manualRotation || (autoRotated ? detectedOrientation : 0),
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Run OCR on a Multi-Page PDF by rendering each page to high-res canvas with Auto-Orientation Detection
 */
export async function performPdfOcr(
  pdfData: ArrayBuffer | Uint8Array,
  language: string = 'eng',
  onProgress?: (info: OcrProgressInfo) => void,
  maxPages: number = 15,
  preprocess: boolean = true,
  autoOrient: boolean = true
): Promise<OcrPageResult[]> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const totalPages = Math.min(pdf.numPages, maxPages);

  const results: OcrPageResult[] = [];

  onProgress?.({
    status: 'Initializing OCR Pipeline',
    progress: 0.05,
    currentPage: 0,
    totalPages,
    currentStage: `Preparing ${totalPages} page(s) for character extraction...`,
  });

  const worker = await createWorker(language, 1, {
    logger: () => {},
  });

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        status: `Rendering Page ${pageNum} of ${totalPages}`,
        progress: (pageNum - 1) / totalPages + 0.02,
        currentPage: pageNum,
        totalPages,
        currentStage: `Rendering high-resolution vector canvas for page ${pageNum}...`,
      });

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      let canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Failed to initialize 2D context');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await (page as any).render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      let detectedOrientation: 0 | 90 | 180 | 270 = 0;
      let autoRotated = false;
      let orientationConfidence = 95;
      let orientationLabel = 'Upright 0°';

      if (autoOrient) {
        onProgress?.({
          status: `Analyzing Page ${pageNum} Orientation`,
          progress: (pageNum - 0.7) / totalPages,
          currentPage: pageNum,
          totalPages,
          currentStage: `Detecting text alignment and orientation for page ${pageNum}...`,
        });

        const orientResult = await autoOrientDocumentCanvas(canvas, worker);
        canvas = orientResult.canvas;
        detectedOrientation = orientResult.detectedAngle;
        autoRotated = orientResult.isRotated;
        orientationConfidence = orientResult.confidence;
        orientationLabel = orientResult.orientationLabel;
      }

      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const processedCanvas = preprocess ? preprocessImageForOcr(canvas) : canvas;
      const ocrInputUrl = processedCanvas.toDataURL('image/png');

      onProgress?.({
        status: `Recognizing Page ${pageNum} of ${totalPages}`,
        progress: (pageNum - 0.5) / totalPages,
        currentPage: pageNum,
        totalPages,
        currentStage: `Analyzing text & layout on page ${pageNum}...`,
      });

      const result = await worker.recognize(ocrInputUrl);
      const data = result.data as any;
      const rawLines = data.lines || data.blocks?.flatMap((b: any) => b.paragraphs?.flatMap((p: any) => p.lines)) || [];

      const lines: OcrLine[] = rawLines.map((l: any) => ({
        text: (l.text || '').trim(),
        confidence: Math.round(l.confidence || 0),
        bbox: {
          x0: l.bbox?.x0 || 0,
          y0: l.bbox?.y0 || 0,
          x1: l.bbox?.x1 || 0,
          y1: l.bbox?.y1 || 0,
        },
        words: (l.words || []).map((w: any) => ({
          text: (w.text || '').trim(),
          confidence: Math.round(w.confidence || 0),
          bbox: {
            x0: w.bbox?.x0 || 0,
            y0: w.bbox?.y0 || 0,
            x1: w.bbox?.x1 || 0,
            y1: w.bbox?.y1 || 0,
          },
        })),
      }));

      results.push({
        pageNumber: pageNum,
        text: data.text.trim(),
        confidence: Math.round(data.confidence),
        lines,
        imageDataUrl: rawDataUrl,
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        detectedOrientation,
        autoRotated,
        orientationConfidence,
        orientationLabel,
        rotationApplied: autoRotated ? detectedOrientation : 0,
      });

      onProgress?.({
        status: `Completed Page ${pageNum} of ${totalPages}`,
        progress: pageNum / totalPages,
        currentPage: pageNum,
        totalPages,
        currentStage: `Page ${pageNum} extracted successfully (${Math.round(data.confidence)}% confidence).`,
      });
    }

    return results;
  } finally {
    await worker.terminate();
  }
}

/**
 * Re-process a single page with a custom manual rotation angle
 */
export async function reprocessPageWithRotation(
  page: OcrPageResult,
  rotationDegrees: number,
  language: string = 'eng',
  preprocess: boolean = true,
  onProgress?: (info: OcrProgressInfo) => void
): Promise<OcrPageResult> {
  const result = await performImageOcr(
    page.imageDataUrl,
    language,
    onProgress,
    preprocess,
    false, // do not auto-orient since manual rotation was requested
    rotationDegrees
  );

  return {
    ...result,
    pageNumber: page.pageNumber,
  };
}

/**
 * Generate a Searchable PDF from OCR results
 * Can produce either:
 * 1. Clean Structured Searchable Document
 * 2. Visual Document with overlayed selectable text
 */
export async function generateSearchablePdf(
  pages: OcrPageResult[],
  options: {
    mode?: 'formatted-document' | 'scanned-with-text-layer';
    title?: string;
    includeWatermark?: boolean;
  } = {}
): Promise<Blob> {
  const { mode = 'scanned-with-text-layer', title = 'OCR Searchable Document', includeWatermark = true } = options;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;

  if (mode === 'scanned-with-text-layer') {
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const p = pages[i];
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2 - 8;

      const imgRatio = p.imageWidth / p.imageHeight;
      let renderW = maxW;
      let renderH = renderW / imgRatio;

      if (renderH > maxH) {
        renderH = maxH;
        renderW = renderH * imgRatio;
      }

      const posX = margin + (maxW - renderW) / 2;
      const posY = margin + 4;

      // Draw high resolution page image
      pdf.addImage(p.imageDataUrl, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');

      // Add selectable text lines
      // We render selectable text with transparent or subtle overlay
      const scaleX = renderW / p.imageWidth;
      const scaleY = renderH / p.imageHeight;

      pdf.setFont('Helvetica', 'normal');
      pdf.setTextColor(255, 255, 255); // near-invisible/selectable background text layer
      pdf.setFontSize(7.5);

      for (const line of p.lines) {
        if (!line.text) continue;
        const lineX = posX + line.bbox.x0 * scaleX;
        const lineY = posY + line.bbox.y1 * scaleY;
        // Text is embedded into PDF content stream making it 100% searchable and copyable
        pdf.text(line.text, Math.max(posX, lineX), Math.min(posY + renderH, lineY), {
          maxWidth: Math.max(10, (line.bbox.x1 - line.bbox.x0) * scaleX + 5),
          renderingMode: 'invisible', // Standard invisible text layer for OCR
        });
      }

      // Small bottom footer
      if (includeWatermark) {
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `WeboDocx Searchable OCR Engine • Page ${i + 1} of ${pages.length} • 100% Selectable Text`,
          pageWidth / 2,
          pageHeight - 4,
          { align: 'center' }
        );
      }
    }
  } else {
    // Formatted Clean Document Mode
    pdf.setFont('Helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(19, 27, 46);
    pdf.text(title, margin, margin + 4);

    pdf.setDrawColor(218, 226, 253);
    pdf.line(margin, margin + 8, pageWidth - margin, margin + 8);

    let currentY = margin + 16;
    const maxLineWidth = pageWidth - margin * 2;

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
        currentY = margin + 8;
      }

      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(0, 35, 111);
      pdf.text(`--- Section: Extracted Page ${p.pageNumber} (Confidence: ${p.confidence}%) ---`, margin, currentY);
      currentY += 8;

      pdf.setFont('Helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);

      const lines = pdf.splitTextToSize(p.text, maxLineWidth);
      for (const line of lines) {
        if (currentY > pageHeight - margin - 8) {
          pdf.addPage('a4', 'portrait');
          currentY = margin + 8;
        }
        pdf.text(line, margin, currentY);
        currentY += 5.2;
      }
    }
  }

  return pdf.output('blob');
}

/**
 * Generate Word (.docx) document from OCR text
 */
export async function generateOcrDocx(
  pages: OcrPageResult[],
  docTitle: string = 'Extracted Document'
): Promise<Blob> {
  const sections = pages.map((p) => {
    const paragraphs: Paragraph[] = [
      new Paragraph({
        text: `Page ${p.pageNumber} Extracted Content (${p.confidence}% OCR Confidence)`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      }),
    ];

    const lines = p.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      lines.forEach((line) => {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 100 },
          })
        );
      });
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '[No text detected on this page]', italics: true, size: 20 })],
          spacing: { after: 100 },
        })
      );
    }

    return paragraphs;
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: docTitle,
            heading: HeadingLevel.TITLE,
            spacing: { after: 300 },
          }),
          ...sections.flat(),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Extract Key Government Entities from OCR Text using Smart Heuristics & RegEx
 */
export function extractGovtEntitiesFromOcr(text: string): ExtractedGovtEntity[] {
  const entities: ExtractedGovtEntity[] = [];

  // 1. PAN Card (e.g. ABCDE1234F)
  const panMatches = text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g);
  if (panMatches) {
    panMatches.forEach((pan) => {
      entities.push({ label: 'Permanent Account Number (PAN)', value: pan, category: 'id' });
    });
  }

  // 2. Aadhaar Number (12 digits, optionally spaced e.g. 1234 5678 9012)
  const aadhaarMatches = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/g);
  if (aadhaarMatches) {
    aadhaarMatches.forEach((aadh) => {
      entities.push({ label: 'Aadhaar Card UID', value: aadh, category: 'id' });
    });
  }

  // 3. Date of Birth / Dates (DD/MM/YYYY or DD-MM-YYYY)
  const dateMatches = text.match(/\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[012])[-/.](19|20)\d\d\b/g);
  if (dateMatches) {
    dateMatches.slice(0, 4).forEach((d) => {
      entities.push({ label: 'Date / DOB Record', value: d, category: 'date' });
    });
  }

  // 4. Roll Numbers / Registration No
  const rollMatches = text.match(/\b(?:Roll\s*(?:No|Number|Code)?[:.\s-]*|Reg\s*(?:No|istration)?[:.\s-]*|Application\s*No[:.\s-]*)([A-Z0-9-]{6,16})\b/gi);
  if (rollMatches) {
    rollMatches.slice(0, 3).forEach((r) => {
      entities.push({ label: 'Roll / Reg / App Number', value: r.trim(), category: 'id' });
    });
  }

  // 5. Mobile Numbers (10 digits starting with 6-9)
  const mobileMatches = text.match(/\b(?:(?:\+91|0)?[6-9]\d{9})\b/g);
  if (mobileMatches) {
    mobileMatches.slice(0, 3).forEach((m) => {
      entities.push({ label: 'Contact Phone Number', value: m, category: 'contact' });
    });
  }

  // 6. Email Addresses
  const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g);
  if (emailMatches) {
    emailMatches.slice(0, 3).forEach((e) => {
      entities.push({ label: 'Email Address', value: e, category: 'contact' });
    });
  }

  // 7. PIN Code (6 digits)
  const pinMatches = text.match(/\b(?:PIN\s*(?:Code)?[:.\s-]*|[A-Za-z]+,\s*)(\d{6})\b/gi);
  if (pinMatches) {
    pinMatches.slice(0, 2).forEach((p) => {
      entities.push({ label: 'Postal PIN Code', value: p.trim(), category: 'general' });
    });
  }

  // Remove duplicates by label+value
  const uniqueEntities = entities.filter(
    (item, index, self) => index === self.findIndex((t) => t.label === item.label && t.value === item.value)
  );

  return uniqueEntities;
}
