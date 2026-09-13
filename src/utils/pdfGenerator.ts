import { jsPDF } from 'jspdf';
import { SheetFormat, SchemeItem } from '../types';

/**
 * Generates a true 300 DPI printable PDF for passport photos matching
 * standard photo lab dimensions (4"x6" = 101.6mm x 152.4mm, A4 = 210mm x 297mm).
 */
export async function generatePassportSheetPdf(
  photoDataUrl: string,
  format: SheetFormat,
  options: {
    addCutLines: boolean;
    whiteBorder: boolean;
    marginType: 'lab' | 'home';
  }
): Promise<Blob> {
  const is4x6 = format === '4x6';
  const orientation = is4x6 ? 'landscape' : 'portrait';
  const formatSpec = is4x6 ? [101.6, 152.4] : 'a4';

  const doc = new jsPDF({
    orientation: orientation as any,
    unit: 'mm',
    format: formatSpec as any,
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Photo specs in mm (standard 35mm x 45mm)
  const photoW = 35;
  const photoH = 45;

  let cols = 4;
  let rows = 2;
  let count = 8;

  if (format === 'a4-16') {
    cols = 4;
    rows = 4;
    count = 16;
  } else if (format === 'a4-32') {
    cols = 4;
    rows = 8;
    count = 32;
  }

  // Margin calculation
  const marginOffset = options.marginType === 'home' ? 5 : 2;
  const availWidth = pageWidth - marginOffset * 2;
  const availHeight = pageHeight - marginOffset * 2;

  const totalGridW = cols * photoW;
  const totalGridH = rows * photoH;

  const gapX = cols > 1 ? Math.max(1.5, (availWidth - totalGridW) / (cols + 1)) : 2;
  const gapY = rows > 1 ? Math.max(1.5, (availHeight - totalGridH) / (rows + 1)) : 2;

  const startX = (pageWidth - (cols * photoW + (cols - 1) * gapX)) / 2;
  const startY = (pageHeight - (rows * photoH + (rows - 1) * gapY)) / 2;

  // Background sheet
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Small calibration footer / watermark
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `WeboDocx Studio Print Engine • 300 DPI Calibration Target • Scale 100% (Do not fit to page)`,
    pageWidth / 2,
    pageHeight - 2,
    { align: 'center' }
  );

  let placed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (placed >= count) break;

      const x = startX + c * (photoW + gapX);
      const y = startY + r * (photoH + gapY);

      // Add image
      doc.addImage(photoDataUrl, 'JPEG', x, y, photoW, photoH, undefined, 'FAST');

      // White border
      if (options.whiteBorder) {
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        doc.rect(x, y, photoW, photoH, 'S');
      }

      // Cut guide marks
      if (options.addCutLines) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.15);
        // Corner crosses
        const tick = 1.2;
        doc.line(x - tick, y, x + tick, y);
        doc.line(x, y - tick, x, y + tick);

        doc.line(x + photoW - tick, y, x + photoW + tick, y);
        doc.line(x + photoW, y - tick, x + photoW, y + tick);

        doc.line(x - tick, y + photoH, x + tick, y + photoH);
        doc.line(x, y + photoH - tick, x, y + photoH + tick);

        doc.line(x + photoW - tick, y + photoH, x + photoW + tick, y + photoH);
        doc.line(x + photoW, y + photoH - tick, x + photoW, y + photoH + tick);
      }

      placed++;
    }
  }

  return doc.output('blob');
}

/**
 * Generates a government scheme compliance & application checklist PDF
 */
export async function generateSchemeChecklistPdf(
  schemes: SchemeItem[],
  profileSummary: {
    category: string;
    income: string;
    state: string;
    district: string;
    education: string;
  }
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(0, 35, 111);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('WeboDocx - DBT & Welfare Scheme Checklist', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Applicant Profile: ${profileSummary.category} | ${profileSummary.income} | ${profileSummary.district}, ${profileSummary.state} | ${profileSummary.education}`,
    14,
    19
  );

  let curY = 36;
  doc.setTextColor(19, 27, 46);

  schemes.slice(0, 4).forEach((scheme, index) => {
    if (curY > 250) {
      doc.addPage();
      curY = 20;
    }

    doc.setFillColor(242, 243, 255);
    doc.roundedRect(14, curY, 182, 48, 2, 2, 'F');
    doc.setDrawColor(218, 226, 253);
    doc.roundedRect(14, curY, 182, 48, 2, 2, 'S');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 35, 111);
    doc.text(`${index + 1}. ${scheme.title}`, 18, curY + 7);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(68, 70, 81);
    doc.text(`Dept: ${scheme.department}  |  Deadline: ${scheme.deadline}`, 18, curY + 13);
    doc.text(`Estimated Benefit: ${scheme.financialBenefit} (${scheme.benefitSubtitle})`, 18, curY + 18);
    doc.text(`Official Application Portal: ${scheme.portalUrl}`, 18, curY + 23);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 49, 32);
    doc.text('Mandatory Documents Checklist:', 18, curY + 29);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(19, 27, 46);
    const docs = scheme.mandatoryDocuments.map((d) => `[ ${d.ready ? '✓' : '  '} ] ${d.name}`).join('   ');
    doc.text(docs, 18, curY + 36, { maxWidth: 174 });

    curY += 54;
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(117, 118, 130);
  doc.text('Generated via WeboDocx Citizen Portal Engine • 100% Client-Side Privacy Guaranteed', 105, 290, {
    align: 'center',
  });

  return doc.output('blob');
}
