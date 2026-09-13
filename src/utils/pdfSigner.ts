import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

export interface SignaturePosition {
  xPercent: number; // 0 - 100 (from left)
  yPercent: number; // 0 - 100 (from top)
  widthPercent: number; // 5 - 100 (% of page width)
  heightPercent: number; // 5 - 100 (% of page height)
}

export interface StampSignatureOptions {
  signatureDataUrl: string;
  pageNumber: number; // 1-indexed, or -1 for all pages
  position: SignaturePosition;
  dateText?: string;
  signatoryName?: string;
  attestationNote?: string;
  includeTimestamp?: boolean;
}

/**
 * Filter signature image to remove off-white/gray background and enhance ink
 */
export async function processSignatureImage(
  imageSource: string,
  options: {
    removeBackground?: boolean;
    bgThreshold?: number; // 0 - 255 (default 215)
    inkColor?: 'original' | 'dark-blue' | 'black';
    cropExcessWhitespace?: boolean;
  } = {}
): Promise<{ dataUrl: string; width: number; height: number }> {
  const {
    removeBackground = true,
    bgThreshold = 215,
    inkColor = 'original',
    cropExcessWhitespace = true,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = 0;
      let maxY = 0;
      let hasInk = false;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 10) continue;

        // Brightness formula
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (removeBackground) {
          if (brightness > bgThreshold) {
            // Treat as paper background -> transparent
            data[i + 3] = 0;
          } else {
            // Keep ink & increase contrast
            const x = (i / 4) % canvas.width;
            const y = Math.floor(i / 4 / canvas.width);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            hasInk = true;

            // Optional ink recoloring / enhancement
            if (inkColor === 'black') {
              data[i] = 18;
              data[i + 1] = 24;
              data[i + 2] = 38;
            } else if (inkColor === 'dark-blue') {
              data[i] = 0;
              data[i + 1] = 35;
              data[i + 2] = 111;
            }
          }
        } else {
          // If not removing background, still track bounding box
          if (brightness < 240) {
            const x = (i / 4) % canvas.width;
            const y = Math.floor(i / 4 / canvas.width);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            hasInk = true;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // If cropping excess whitespace and ink was found
      if (cropExcessWhitespace && hasInk && maxX > minX && maxY > minY) {
        const padding = 10;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropW = Math.min(canvas.width - cropX, maxX - minX + padding * 2);
        const cropH = Math.min(canvas.height - cropY, maxY - minY + padding * 2);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          resolve({
            dataUrl: cropCanvas.toDataURL('image/png'),
            width: cropW,
            height: cropH,
          });
          return;
        }
      }

      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = (e) => reject(e);
    img.src = imageSource;
  });
}

/**
 * Converts data URL to Uint8Array for pdf-lib embedding
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Stamp signature image onto PDF page(s) using pdf-lib
 */
export async function stampSignatureOnPdf(
  pdfBuffer: ArrayBuffer,
  options: StampSignatureOptions
): Promise<{ signedBlob: Blob; totalPages: number; sizeKb: number }> {
  const {
    signatureDataUrl,
    pageNumber,
    position,
    dateText,
    signatoryName,
    attestationNote,
    includeTimestamp = false,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  if (totalPages === 0) {
    throw new Error('PDF document has no pages.');
  }

  // Embed PNG signature image
  const imageBytes = dataUrlToUint8Array(signatureDataUrl);
  const signatureImage = await pdfDoc.embedPng(imageBytes);

  // Standard Helvetica Font for annotation
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const targetPageIndices: number[] = [];
  if (pageNumber === -1) {
    // All pages
    for (let i = 0; i < totalPages; i++) targetPageIndices.push(i);
  } else {
    // 1-indexed to 0-indexed
    const idx = Math.max(0, Math.min(totalPages - 1, pageNumber - 1));
    targetPageIndices.push(idx);
  }

  for (const pageIdx of targetPageIndices) {
    const page = pdfDoc.getPage(pageIdx);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Calculate dimensions in PDF points
    const stampWidth = (position.widthPercent / 100) * pageWidth;
    const stampHeight = (position.heightPercent / 100) * pageHeight;

    // PDF Coordinate system has (0,0) at bottom-left
    // DOM coordinate system has (0,0) at top-left
    const stampX = (position.xPercent / 100) * pageWidth;
    const stampY = pageHeight - (position.yPercent / 100) * pageHeight - stampHeight;

    // 1. Draw the signature image
    page.drawImage(signatureImage, {
      x: Math.max(0, stampX),
      y: Math.max(0, stampY),
      width: stampWidth,
      height: stampHeight,
    });

    // 2. If attestation / signatory / date text is enabled, draw cleanly below the signature
    let textY = stampY - 8;
    const textColor = rgb(0.08, 0.14, 0.28);
    const mutedColor = rgb(0.3, 0.35, 0.45);

    if (attestationNote && attestationNote.trim()) {
      page.drawText(attestationNote.trim(), {
        x: Math.max(10, stampX),
        y: Math.max(10, textY),
        size: 7.5,
        font: helveticaBold,
        color: rgb(0.0, 0.2, 0.5),
      });
      textY -= 9;
    }

    if (signatoryName && signatoryName.trim()) {
      page.drawText(`Signed by: ${signatoryName.trim()}`, {
        x: Math.max(10, stampX),
        y: Math.max(10, textY),
        size: 7,
        font: helveticaBold,
        color: textColor,
      });
      textY -= 8.5;
    }

    if (dateText && dateText.trim()) {
      const fullDateStr = includeTimestamp
        ? `Date: ${dateText.trim()} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
        : `Date: ${dateText.trim()}`;

      page.drawText(fullDateStr, {
        x: Math.max(10, stampX),
        y: Math.max(10, textY),
        size: 6.5,
        font: helveticaFont,
        color: mutedColor,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const signedBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const sizeKb = Math.round(signedBlob.size / 1024);

  return { signedBlob, totalPages, sizeKb };
}
