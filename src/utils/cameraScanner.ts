import { jsPDF } from 'jspdf';
import { QuadCorners, ScannedDocumentPage, ScanFilterMode, Point2D } from '../types';

/**
 * Returns default full-frame corners
 */
export function getDefaultCorners(): QuadCorners {
  return {
    topLeft: { x: 0.05, y: 0.05 },
    topRight: { x: 0.95, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.95 },
    bottomLeft: { x: 0.05, y: 0.95 },
  };
}

/**
 * Automatically detects document corners on a given image element or canvas
 * Uses luminance gradients to find the rectangular document boundaries.
 */
export function autoDetectDocumentCorners(
  sourceCanvas: HTMLCanvasElement
): QuadCorners {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const sampleW = 320;
  const sampleH = Math.max(100, Math.round((h / w) * sampleW));

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleW;
  sampleCanvas.height = sampleH;
  const ctx = sampleCanvas.getContext('2d');
  if (!ctx) return getDefaultCorners();

  ctx.drawImage(sourceCanvas, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // Compute grayscale luminance
  const gray = new Uint8Array(sampleW * sampleH);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(
      0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    );
  }

  // Calculate row and column edge profiles from borders inwards
  let topY = 0;
  let bottomY = sampleH - 1;
  let leftX = 0;
  let rightX = sampleW - 1;

  // Search top edge (from 4% to 35% height)
  for (let y = Math.round(sampleH * 0.04); y < Math.round(sampleH * 0.35); y++) {
    let edgeEnergy = 0;
    for (let x = Math.round(sampleW * 0.2); x < Math.round(sampleW * 0.8); x++) {
      const gCurrent = gray[y * sampleW + x];
      const gNext = gray[(y + 2) * sampleW + x];
      edgeEnergy += Math.abs(gCurrent - gNext);
    }
    if (edgeEnergy / (sampleW * 0.6) > 28) {
      topY = y;
      break;
    }
  }

  // Search bottom edge (from 96% down to 65% height)
  for (let y = Math.round(sampleH * 0.96); y > Math.round(sampleH * 0.65); y--) {
    let edgeEnergy = 0;
    for (let x = Math.round(sampleW * 0.2); x < Math.round(sampleW * 0.8); x++) {
      const gCurrent = gray[y * sampleW + x];
      const gPrev = gray[(y - 2) * sampleW + x];
      edgeEnergy += Math.abs(gCurrent - gPrev);
    }
    if (edgeEnergy / (sampleW * 0.6) > 28) {
      bottomY = y;
      break;
    }
  }

  // Search left edge (from 4% to 35% width)
  for (let x = Math.round(sampleW * 0.04); x < Math.round(sampleW * 0.35); x++) {
    let edgeEnergy = 0;
    for (let y = Math.round(sampleH * 0.2); y < Math.round(sampleH * 0.8); y++) {
      const gCurrent = gray[y * sampleW + x];
      const gNext = gray[y * sampleW + (x + 2)];
      edgeEnergy += Math.abs(gCurrent - gNext);
    }
    if (edgeEnergy / (sampleH * 0.6) > 28) {
      leftX = x;
      break;
    }
  }

  // Search right edge (from 96% down to 65% width)
  for (let x = Math.round(sampleW * 0.96); x > Math.round(sampleW * 0.65); x--) {
    let edgeEnergy = 0;
    for (let y = Math.round(sampleH * 0.2); y < Math.round(sampleH * 0.8); y++) {
      const gCurrent = gray[y * sampleW + x];
      const gPrev = gray[y * sampleW + (x - 2)];
      edgeEnergy += Math.abs(gCurrent - gPrev);
    }
    if (edgeEnergy / (sampleH * 0.6) > 28) {
      rightX = x;
      break;
    }
  }

  const normLeft = Math.max(0.02, Math.min(0.25, leftX / sampleW));
  const normRight = Math.min(0.98, Math.max(0.75, rightX / sampleW));
  const normTop = Math.max(0.02, Math.min(0.25, topY / sampleH));
  const normBottom = Math.min(0.98, Math.max(0.75, bottomY / sampleH));

  return {
    topLeft: { x: normLeft, y: normTop },
    topRight: { x: normRight, y: normTop },
    bottomRight: { x: normRight, y: normBottom },
    bottomLeft: { x: normLeft, y: normBottom },
  };
}

/**
 * Invert 3x3 matrix for perspective transformation
 */
function invert3x3(m: number[]): number[] | null {
  const [
    a, b, c,
    d, e, f,
    g, h, i
  ] = m;

  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const H = -(a * f - c * d);
  const I = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-7) return null;

  const invDet = 1.0 / det;
  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, H * invDet,
    C * invDet, F * invDet, I * invDet,
  ];
}

/**
 * Computes 3x3 Projective Transform (Homography) matrix from source quad to destination rectangle.
 */
function getProjectiveTransform(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[]
): number[] | null {
  // src[0..3] -> dst[0..3]
  // We solve system: H * [x, y, 1]^T = w * [u, v, 1]^T
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    a.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    a.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Gaussian elimination for 8x8 linear system
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[maxRow][i])) {
        maxRow = k;
      }
    }
    const tmpA = a[i];
    a[i] = a[maxRow];
    a[maxRow] = tmpA;

    const tmpB = b[i];
    b[i] = b[maxRow];
    b[maxRow] = tmpB;

    if (Math.abs(a[i][i]) < 1e-9) return null;

    for (let k = i + 1; k < n; k++) {
      const c = -a[k][i] / a[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          a[k][j] = 0;
        } else {
          a[k][j] += c * a[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  const h = new Array(9);
  h[8] = 1;

  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += a[i][j] * h[j];
    }
    h[i] = (b[i] - sum) / a[i][i];
  }

  return h;
}

/**
 * Perspective warp a quadrilateral region into a flat rectangular canvas
 */
export function warpPerspective(
  sourceCanvas: HTMLCanvasElement,
  corners: QuadCorners,
  outputWidth?: number,
  outputHeight?: number
): HTMLCanvasElement {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;

  // Source pixel coordinates
  const p0 = { x: corners.topLeft.x * sw, y: corners.topLeft.y * sh };
  const p1 = { x: corners.topRight.x * sw, y: corners.topRight.y * sh };
  const p2 = { x: corners.bottomRight.x * sw, y: corners.bottomRight.y * sh };
  const p3 = { x: corners.bottomLeft.x * sw, y: corners.bottomLeft.y * sh };

  // Determine output dimensions based on average quad width & height if not specified
  const topW = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const botW = Math.hypot(p2.x - p3.x, p2.y - p3.y);
  const avgW = Math.max(200, Math.round((topW + botW) / 2));

  const leftH = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  const rightH = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const avgH = Math.max(200, Math.round((leftH + rightH) / 2));

  const dw = outputWidth || avgW;
  const dh = outputHeight || avgH;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dw;
  dstCanvas.height = dh;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) return sourceCanvas;

  const srcPoints = [p0, p1, p2, p3];
  const dstPoints = [
    { x: 0, y: 0 },
    { x: dw, y: 0 },
    { x: dw, y: dh },
    { x: 0, y: dh },
  ];

  const H = getProjectiveTransform(srcPoints, dstPoints);
  if (!H) {
    // Fallback simple clip
    dstCtx.drawImage(sourceCanvas, 0, 0, dw, dh);
    return dstCanvas;
  }

  const Hinv = invert3x3(H);
  if (!Hinv) {
    dstCtx.drawImage(sourceCanvas, 0, 0, dw, dh);
    return dstCanvas;
  }

  const srcCtx = sourceCanvas.getContext('2d');
  if (!srcCtx) return sourceCanvas;
  const srcImgData = srcCtx.getImageData(0, 0, sw, sh);
  const srcData = srcImgData.data;

  const dstImgData = dstCtx.createImageData(dw, dh);
  const dstData = dstImgData.data;

  const [
    m00, m01, m02,
    m10, m11, m12,
    m20, m21, m22
  ] = Hinv;

  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      const dstIdx = (dy * dw + dx) * 4;

      // Projective backward mapping: (sx, sy) = Hinv * (dx, dy, 1)
      const w = m20 * dx + m21 * dy + m22;
      if (Math.abs(w) < 1e-6) continue;

      const sx = (m00 * dx + m01 * dy + m02) / w;
      const sy = (m10 * dx + m11 * dy + m12) / w;

      if (sx >= 0 && sx < sw - 1 && sy >= 0 && sy < sh - 1) {
        // Bilinear interpolation
        const x0 = Math.floor(sx);
        const x1 = x0 + 1;
        const y0 = Math.floor(sy);
        const y1 = y0 + 1;

        const fx = sx - x0;
        const fy = sy - y0;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const idx00 = (y0 * sw + x0) * 4;
        const idx10 = (y0 * sw + x1) * 4;
        const idx01 = (y1 * sw + x0) * 4;
        const idx11 = (y1 * sw + x1) * 4;

        dstData[dstIdx] = Math.round(
          srcData[idx00] * w00 +
          srcData[idx10] * w10 +
          srcData[idx01] * w01 +
          srcData[idx11] * w11
        );
        dstData[dstIdx + 1] = Math.round(
          srcData[idx00 + 1] * w00 +
          srcData[idx10 + 1] * w10 +
          srcData[idx01 + 1] * w01 +
          srcData[idx11 + 1] * w11
        );
        dstData[dstIdx + 2] = Math.round(
          srcData[idx00 + 2] * w00 +
          srcData[idx10 + 2] * w10 +
          srcData[idx01 + 2] * w01 +
          srcData[idx11 + 2] * w11
        );
        dstData[dstIdx + 3] = 255;
      } else {
        dstData[dstIdx] = 255;
        dstData[dstIdx + 1] = 255;
        dstData[dstIdx + 2] = 255;
        dstData[dstIdx + 3] = 255;
      }
    }
  }

  dstCtx.putImageData(dstImgData, 0, 0);
  return dstCanvas;
}

/**
 * Rotate canvas clockwise by specified degrees (0, 90, 180, 270)
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

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return canvas;
}

/**
 * Apply Document Enhancement Filters (Magic Color, Clean B&W, High Contrast, Grayscale)
 */
export function applyDocumentFilter(
  canvas: HTMLCanvasElement,
  filterMode: ScanFilterMode,
  brightness: number = 0, // -50 to +50
  contrast: number = 0    // -50 to +50
): HTMLCanvasElement {
  if (filterMode === 'original' && brightness === 0 && contrast === 0) {
    return canvas;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = canvas.width;
  outCanvas.height = canvas.height;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, outCanvas.width, outCanvas.height);
  const data = imgData.data;
  const len = data.length;

  // Contrast multiplier
  const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const bVal = brightness * 1.8;

  if (filterMode === 'magic-color') {
    // Magic Color: Whitens background, sharpens black text, enhances colored stamps & seals
    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > 180) {
        // Light paper background -> push to crisp white
        const boost = (lum - 180) / 75;
        r = Math.min(255, r + 45 * boost);
        g = Math.min(255, g + 45 * boost);
        b = Math.min(255, b + 45 * boost);
      } else if (lum < 95) {
        // Dark text -> deepen black contrast
        r = Math.max(0, r * 0.75);
        g = Math.max(0, g * 0.75);
        b = Math.max(0, b * 0.75);
      } else {
        // Midtones: enhance colored inks/stamps
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC - minC;
        if (sat > 20) {
          // Colorful stamp or pen ink: boost saturation
          const mean = (r + g + b) / 3;
          r = Math.min(255, Math.max(0, mean + (r - mean) * 1.35));
          g = Math.min(255, Math.max(0, mean + (g - mean) * 1.35));
          b = Math.min(255, Math.max(0, mean + (b - mean) * 1.35));
        }
      }

      // Apply brightness & contrast
      r = Math.min(255, Math.max(0, cFactor * (r - 128) + 128 + bVal));
      g = Math.min(255, Math.max(0, cFactor * (g - 128) + 128 + bVal));
      b = Math.min(255, Math.max(0, cFactor * (b - 128) + 128 + bVal));

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  } else if (filterMode === 'doc-bw') {
    // Document B&W: Adaptive thresholding for clean photocopy
    // 1. Calculate average local luminance
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Threshold with adjustable bias
      const threshold = 145 - bVal * 0.5;
      const finalVal = gray < threshold ? 0 : 255;

      data[i] = finalVal;
      data[i + 1] = finalVal;
      data[i + 2] = finalVal;
    }
  } else if (filterMode === 'grayscale') {
    // Grayscale: Clean gray with boosted text contrast
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Contrast S-curve
      if (gray > 185) {
        gray = Math.min(255, gray + 25);
      } else if (gray < 85) {
        gray = Math.max(0, gray - 20);
      }

      gray = Math.min(255, Math.max(0, cFactor * (gray - 128) + 128 + bVal));

      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  } else if (filterMode === 'high-contrast') {
    // High Contrast color
    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      const highC = (259 * (contrast + 35 + 255)) / (255 * (259 - (contrast + 35)));
      r = Math.min(255, Math.max(0, highC * (r - 128) + 128 + bVal + 10));
      g = Math.min(255, Math.max(0, highC * (g - 128) + 128 + bVal + 10));
      b = Math.min(255, Math.max(0, highC * (b - 128) + 128 + bVal + 10));

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  } else {
    // Original with optional Brightness / Contrast adjustment
    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      r = Math.min(255, Math.max(0, cFactor * (r - 128) + 128 + bVal));
      g = Math.min(255, Math.max(0, cFactor * (g - 128) + 128 + bVal));
      b = Math.min(255, Math.max(0, cFactor * (b - 128) + 128 + bVal));

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return outCanvas;
}

/**
 * Loads an image from dataURL into HTMLImageElement
 */
export function loadImageAsync(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

/**
 * Renders a full ScannedDocumentPage into a final high-resolution processed canvas
 */
export async function renderProcessedPageCanvas(
  page: ScannedDocumentPage
): Promise<HTMLCanvasElement> {
  const img = await loadImageAsync(page.originalDataUrl);
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = img.naturalWidth || img.width;
  baseCanvas.height = img.naturalHeight || img.height;
  const ctx = baseCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');
  ctx.drawImage(img, 0, 0);

  // 1. Perspective warp / crop if enabled
  let warpedCanvas = baseCanvas;
  if (page.isCropped && page.corners) {
    warpedCanvas = warpPerspective(baseCanvas, page.corners);
  }

  // 2. Rotate
  let rotatedCanvas = warpedCanvas;
  if (page.rotation !== 0) {
    rotatedCanvas = rotateCanvas(warpedCanvas, page.rotation);
  }

  // 3. Document enhancement filter + Brightness/Contrast
  const filteredCanvas = applyDocumentFilter(
    rotatedCanvas,
    page.filterMode,
    page.brightness,
    page.contrast
  );

  return filteredCanvas;
}

/**
 * Export multiple scanned pages into a standard Searchable/Crisp PDF
 */
export async function exportScannedPagesToPdf(
  pages: ScannedDocumentPage[],
  options: {
    pageSize?: 'a4' | 'fit';
    orientation?: 'portrait' | 'landscape' | 'auto';
    quality?: number; // 0.6 - 0.95
    fileName?: string;
  } = {}
): Promise<{ blob: Blob; dataUrl: string; sizeKb: number; fileName: string }> {
  if (!pages.length) throw new Error('No pages to export');

  const {
    pageSize = 'a4',
    quality = 0.88,
    fileName = `WeboDocx_Scan_${new Date().toISOString().slice(0, 10)}.pdf`,
  } = options;

  let doc: jsPDF | null = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageCanvas = await renderProcessedPageCanvas(page);
    const imgWidth = pageCanvas.width;
    const imgHeight = pageCanvas.height;
    const isLandscape = imgWidth > imgHeight;

    const pageImgData = pageCanvas.toDataURL('image/jpeg', quality);

    if (pageSize === 'a4') {
      const orientation = isLandscape ? 'landscape' : 'portrait';
      if (i === 0) {
        doc = new jsPDF({
          orientation,
          unit: 'mm',
          format: 'a4',
        });
      } else {
        doc?.addPage('a4', orientation);
      }

      const pageWidth = orientation === 'portrait' ? 210 : 297;
      const pageHeight = orientation === 'portrait' ? 297 : 210;

      // Calculate fitted aspect ratio on A4
      const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;
      const posX = (pageWidth - drawW) / 2;
      const posY = (pageHeight - drawH) / 2;

      doc?.addImage(pageImgData, 'JPEG', posX, posY, drawW, drawH, undefined, 'FAST');
    } else {
      // Fit original document dimensions in mm (72 DPI baseline)
      const mmW = (imgWidth * 25.4) / 150;
      const mmH = (imgHeight * 25.4) / 150;
      const orientation = mmW > mmH ? 'landscape' : 'portrait';

      if (i === 0) {
        doc = new jsPDF({
          orientation,
          unit: 'mm',
          format: [mmW, mmH],
        });
      } else {
        doc?.addPage([mmW, mmH], orientation);
      }

      doc?.addImage(pageImgData, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
    }
  }

  if (!doc) throw new Error('Failed to generate PDF document');

  const blob = doc.output('blob');
  const dataUrl = doc.output('datauristring');
  const sizeKb = Math.round(blob.size / 1024);

  return {
    blob,
    dataUrl,
    sizeKb,
    fileName,
  };
}

/**
 * Creates a File object from a ScannedDocumentPage for direct transfer to OCR or Signer
 */
export async function createPdfFileFromScannedPages(
  pages: ScannedDocumentPage[],
  fileName: string = 'scanned-document.pdf'
): Promise<File> {
  const result = await exportScannedPagesToPdf(pages, { fileName });
  return new File([result.blob], fileName, { type: 'application/pdf' });
}
