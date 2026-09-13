/**
 * Utilities for client-side image processing, canvas transformation,
 * Date of Photo (DOP) stamp overlay, background whitening, and JPEG DPI metadata injection.
 */

export interface RenderPhotoOptions {
  image: HTMLImageElement;
  width: number;
  height: number;
  zoom: number; // e.g. 1.2 for 120%
  rotation: number; // 0, 90, 180, 270
  panX: number;
  panY: number;
  addDop: boolean;
  candidateName: string;
  dateOfPhoto: string;
  stampStyle?: 'boxed' | 'semi';
  applyWhitener?: boolean;
  borderWhite?: boolean;
}

/**
 * Renders the candidate image into an off-screen canvas with exact dimensions,
 * transforms, whitening filter, and mandatory Date of Photo (DOP) stamp.
 */
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  options: RenderPhotoOptions
): void {
  const {
    image,
    width,
    height,
    zoom,
    rotation,
    panX,
    panY,
    addDop,
    candidateName,
    dateOfPhoto,
    stampStyle = 'boxed',
    applyWhitener = false,
    borderWhite = false,
  } = options;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  // Move to center of canvas for transforms
  ctx.translate(width / 2 + panX, height / 2 + panY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(zoom, zoom);

  if (applyWhitener) {
    ctx.filter = 'contrast(1.08) brightness(1.05) saturate(1.02)';
  }

  // Draw image centered
  const aspect = image.width / image.height;
  let drawW = width;
  let drawH = width / aspect;
  if (drawH < height) {
    drawH = height;
    drawW = height * aspect;
  }

  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // White border if requested (e.g. 1.5mm)
  if (borderWhite) {
    const borderWidth = Math.max(2, Math.round(width * 0.02));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = borderWidth * 2;
    ctx.strokeRect(0, 0, width, height);
  }

  // Draw DOP / Name Stamp banner if enabled
  if (addDop && (candidateName.trim() || dateOfPhoto.trim())) {
    const bannerHeight = Math.round(height * 0.14);
    const bannerY = height - bannerHeight;

    if (stampStyle === 'boxed') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.fillRect(0, bannerY, width, bannerHeight);

      // Top subtle border
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, bannerY, width, 1);
    } else {
      // Soft pill style
      const margin = Math.round(width * 0.03);
      const pillW = width - margin * 2;
      const pillH = bannerHeight - margin;
      const pillY = height - bannerHeight + margin / 2;
      const pillRadius = 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.roundRect(margin, pillY, pillW, pillH, pillRadius);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const nameFontSize = Math.max(10, Math.round(width * 0.048));
    const dateFontSize = Math.max(8, Math.round(width * 0.038));

    // Name text
    ctx.fillStyle = '#131b2e';
    ctx.font = `bold ${nameFontSize}px 'Inter', sans-serif`;
    ctx.fillText(
      candidateName.toUpperCase(),
      width / 2,
      bannerY + bannerHeight * 0.38
    );

    // DOP text
    ctx.fillStyle = '#444651';
    ctx.font = `600 ${dateFontSize}px 'Inter', sans-serif`;
    const formattedDop = dateOfPhoto.toUpperCase().startsWith('DOP')
      ? dateOfPhoto.toUpperCase()
      : `DOP: ${dateOfPhoto.toUpperCase()}`;
    ctx.fillText(formattedDop, width / 2, bannerY + bannerHeight * 0.74);
  }
}

/**
 * Injects standard JFIF 200 DPI or 300 DPI headers into a JPEG ArrayBuffer.
 * This satisfies strict server validation on NIC, UPSC, and SSC portals.
 */
export function injectDpiIntoJpeg(
  arrayBuffer: ArrayBuffer,
  dpi: number = 200
): ArrayBuffer {
  const view = new DataView(arrayBuffer);
  // Check SOI marker (0xFFD8)
  if (view.getUint16(0) !== 0xffd8) {
    return arrayBuffer;
  }

  let offset = 2;
  while (offset < view.byteLength - 4) {
    const marker = view.getUint16(offset);
    // Look for APP0 marker (0xFFE0)
    if (marker === 0xffe0) {
      // Density units: 1 = pixels per inch (DPI)
      // Offset + 2 is length (2 bytes)
      // Offset + 4 is 'JFIF\0' (5 bytes)
      // Offset + 9 is version (2 bytes)
      // Offset + 11 is units (1 byte) -> set to 1
      // Offset + 12 is Xdensity (2 bytes) -> set to dpi
      // Offset + 14 is Ydensity (2 bytes) -> set to dpi
      const app0Offset = offset;
      if (
        view.getUint8(app0Offset + 4) === 0x4a && // 'J'
        view.getUint8(app0Offset + 5) === 0x46 && // 'F'
        view.getUint8(app0Offset + 6) === 0x49 && // 'I'
        view.getUint8(app0Offset + 7) === 0x46 && // 'F'
        view.getUint8(app0Offset + 8) === 0x00
      ) {
        view.setUint8(app0Offset + 11, 1); // DPI unit
        view.setUint16(app0Offset + 12, dpi); // X DPI
        view.setUint16(app0Offset + 14, dpi); // Y DPI
        return arrayBuffer;
      }
    }
    const len = view.getUint16(offset + 2);
    offset += 2 + len;
  }

  return arrayBuffer;
}

/**
 * Compresses canvas to target KB size with exact binary optimization
 */
export async function compressCanvasToTarget(
  canvas: HTMLCanvasElement,
  targetKb: number,
  initialQuality: number = 0.88,
  dpi: number = 200
): Promise<{ blob: Blob; sizeKb: number; qualityUsed: number }> {
  let low = 0.2;
  let high = 0.98;
  let bestBlob: Blob | null = null;
  let bestDiff = Infinity;
  let bestQuality = initialQuality;

  // Binary search for ideal JPEG quality to match target weight
  for (let step = 0; step < 6; step++) {
    const currentQ = (low + high) / 2;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', currentQ)
    );

    if (!blob) break;

    const sizeKb = blob.size / 1024;
    const diff = Math.abs(sizeKb - targetKb);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestBlob = blob;
      bestQuality = currentQ;
    }

    if (sizeKb < targetKb) {
      low = currentQ;
    } else {
      high = currentQ;
    }
  }

  if (!bestBlob) {
    bestBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', initialQuality)
    );
  }

  // Inject DPI header
  const arrayBuffer = await bestBlob.arrayBuffer();
  const modifiedBuffer = injectDpiIntoJpeg(arrayBuffer, dpi);
  const finalBlob = new Blob([modifiedBuffer], { type: 'image/jpeg' });

  return {
    blob: finalBlob,
    sizeKb: Number((finalBlob.size / 1024).toFixed(1)),
    qualityUsed: Math.round(bestQuality * 100),
  };
}
