import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  performImageOcr,
  performPdfOcr,
  generateSearchablePdf,
  generateOcrDocx,
  extractGovtEntitiesFromOcr,
  reprocessPageWithRotation,
  OcrPageResult,
  OcrProgressInfo,
  ExtractedGovtEntity,
} from '../utils/ocrEngine';
import { ToastMessage, TaskManager, NavView } from '../types';
import { recordRecentActivity } from '../utils/recentActivityStore';

interface OcrToolSectionProps {
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
  onNavigate?: (view: NavView) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'eng', name: 'English (Official Docs & Forms)', flag: '🇬🇧' },
  { code: 'hin', name: 'Hindi (हिंदी)', flag: '🇮🇳' },
  { code: 'eng+hin', name: 'English + Hindi (Bilingual Forms)', flag: '🇮🇳' },
  { code: 'ben', name: 'Bengali (বাংলা)', flag: '🇮🇳' },
  { code: 'mar', name: 'Marathi (मराठी)', flag: '🇮🇳' },
  { code: 'tam', name: 'Tamil (தமிழ்)', flag: '🇮🇳' },
  { code: 'tel', name: 'Telugu (తెలుగు)', flag: '🇮🇳' },
  { code: 'urd', name: 'Urdu (اردو)', flag: '🇮🇳' },
  { code: 'guj', name: 'Gujarati (ગુજરાતી)', flag: '🇮🇳' },
  { code: 'kan', name: 'Kannada (ಕನ್ನಡ)', flag: '🇮🇳' },
  { code: 'mal', name: 'Malayalam (മലയാളം)', flag: '🇮🇳' },
  { code: 'fra', name: 'French (Français)', flag: '🇫🇷' },
  { code: 'spa', name: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'deu', name: 'German (Deutsch)', flag: '🇩🇪' },
];

export const OcrToolSection: React.FC<OcrToolSectionProps> = ({
  onAddToast,
  taskManager,
  onNavigate,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('eng');
  const [maxPdfPages, setMaxPdfPages] = useState<number>(5);
  const [enhanceScan, setEnhanceScan] = useState<boolean>(true);
  const [autoOrient, setAutoOrient] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isReorienting, setIsReorienting] = useState<boolean>(false);
  const [progressInfo, setProgressInfo] = useState<OcrProgressInfo | null>(null);
  
  // Results
  const [ocrResults, setOcrResults] = useState<OcrPageResult[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'editor' | 'entities' | 'preview'>('editor');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [searchWord, setSearchWord] = useState<string>('');
  const [extractedEntities, setExtractedEntities] = useState<ExtractedGovtEntity[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    const isImage = selectedFile.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|tiff)$/i.test(selectedFile.name);

    if (!isPdf && !isImage) {
      onAddToast({
        title: 'Unsupported Format',
        description: 'Please upload a PDF document or an image (JPG, PNG, WEBP, BMP).',
        type: 'error',
      });
      return;
    }

    setFile(selectedFile);
    setOcrResults([]);
    setProgressInfo(null);
    setSelectedPageIndex(0);

    onAddToast({
      title: 'Document Loaded for OCR',
      description: `Loaded "${selectedFile.name}" (${Math.round(selectedFile.size / 1024)} KB). Auto-orientation analysis will verify upright layout before text extraction.`,
      type: 'info',
    });
  }, [onAddToast]);

  // When OCR results update, extract entities
  useEffect(() => {
    if (ocrResults.length > 0) {
      const fullText = ocrResults.map((r) => r.text).join('\n\n');
      const entities = extractGovtEntitiesFromOcr(fullText);
      setExtractedEntities(entities);
    } else {
      setExtractedEntities([]);
    }
  }, [ocrResults]);

  // Check for pending OCR PDF transferred from Camera Scanner
  useEffect(() => {
    const pendingPdf = sessionStorage.getItem('WEBODOCX_PENDING_OCR_PDF');
    const pendingName = sessionStorage.getItem('WEBODOCX_PENDING_OCR_NAME') || 'Scanned_Document.pdf';
    if (pendingPdf) {
      sessionStorage.removeItem('WEBODOCX_PENDING_OCR_PDF');
      sessionStorage.removeItem('WEBODOCX_PENDING_OCR_NAME');
      fetch(pendingPdf)
        .then((r) => r.blob())
        .then((blob) => {
          const loadedFile = new File([blob], pendingName, { type: 'application/pdf' });
          handleFileSelect(loadedFile);
        })
        .catch((err) => console.warn('Pending OCR load error:', err));
    }
  }, [handleFileSelect]);

  const handleRunOcr = async () => {
    if (!file) return;

    setIsProcessing(true);
    taskManager?.startTask(`Running OCR on ${file.name}`, 10, 'Analyzing document layout & initializing OCR engine...');

    try {
      let results: OcrPageResult[] = [];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const buffer = await file.arrayBuffer();
        results = await performPdfOcr(
          buffer,
          language,
          (info) => {
            setProgressInfo(info);
            taskManager?.updateProgress(Math.round(info.progress * 100), info.currentStage);
          },
          maxPdfPages,
          enhanceScan,
          autoOrient
        );
      } else {
        results = [
          await performImageOcr(
            file,
            language,
            (info) => {
              setProgressInfo(info);
              taskManager?.updateProgress(Math.round(info.progress * 100), info.currentStage);
            },
            enhanceScan,
            autoOrient
          ),
        ];
      }

      setOcrResults(results);
      setSelectedPageIndex(0);

      const totalWords = results.reduce((acc, p) => acc + p.lines.reduce((lAcc, l) => lAcc + l.words.length, 0), 0);
      const avgConfidence = Math.round(
        results.reduce((acc, p) => acc + p.confidence, 0) / (results.length || 1)
      );

      const rotatedCount = results.filter((r) => r.autoRotated).length;
      const orientSummary = rotatedCount > 0
        ? ` (Auto-aligned ${rotatedCount} rotated page(s))`
        : ' (Layout upright)';

      taskManager?.completeTask(`OCR extracted ${totalWords} words across ${results.length} page(s)${orientSummary}`, 500);

      onAddToast({
        title: 'OCR Extraction Successful!',
        description: `Recognized ${totalWords} words across ${results.length} page(s) with ${avgConfidence}% confidence${orientSummary}.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('OCR Error:', err);
      taskManager?.failTask(`OCR failed: ${err?.message || 'Error parsing document'}`);
      onAddToast({
        title: 'OCR Extraction Failed',
        description: `Error: ${err?.message || 'Could not process document. Please verify image clarity.'}`,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual Page Rotation & Re-extraction Handler
  const handleManualRotatePage = async (degreesDelta: number) => {
    const page = ocrResults[selectedPageIndex];
    if (!page || isReorienting) return;

    setIsReorienting(true);
    taskManager?.startTask(`Rotating Page ${page.pageNumber}...`, 20, `Rotating page by ${degreesDelta}° and re-extracting characters...`);

    try {
      const updatedPage = await reprocessPageWithRotation(
        page,
        degreesDelta,
        language,
        enhanceScan,
        (info) => {
          taskManager?.updateProgress(Math.round(info.progress * 100), info.currentStage);
        }
      );

      setOcrResults((prev) =>
        prev.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p))
      );

      taskManager?.completeTask(`Page ${page.pageNumber} rotated ${degreesDelta}° & re-extracted successfully`, 400);
      onAddToast({
        title: `Page ${page.pageNumber} Rotated ${degreesDelta > 0 ? '+' : ''}${degreesDelta}°`,
        description: `Re-extracted text and bounding boxes with ${updatedPage.confidence}% confidence.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Re-orientation error:', err);
      taskManager?.failTask(`Failed to rotate page: ${err?.message}`);
      onAddToast({
        title: 'Rotation & Re-Extraction Failed',
        description: err?.message || 'Could not re-process rotated page.',
        type: 'error',
      });
    } finally {
      setIsReorienting(false);
    }
  };

  const handlePageTextChange = (newText: string) => {
    setOcrResults((prev) =>
      prev.map((page, idx) => (idx === selectedPageIndex ? { ...page, text: newText } : page))
    );
  };

  // Export Searchable PDF
  const handleExportSearchablePdf = async (mode: 'scanned-with-text-layer' | 'formatted-document') => {
    if (ocrResults.length === 0) return;
    setIsExporting(true);

    try {
      taskManager?.startTask('Generating Searchable PDF...', 30, 'Embedding vector text layer...');
      const blob = await generateSearchablePdf(ocrResults, {
        mode,
        title: file ? file.name.replace(/\.[^/.]+$/, '') : 'OCR_Searchable_Document',
        includeWatermark: true,
      });

      const url = URL.createObjectURL(blob);
      const downloadName = `${file ? file.name.replace(/\.[^/.]+$/, '') : 'Document'}_Searchable_OCR.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        recordRecentActivity({
          fileName: downloadName,
          category: 'ocr',
          fileType: 'pdf',
          sizeKb: Math.round(blob.size / 1024),
          originalSizeKb: file ? Math.round(file.size / 1024) : undefined,
          details: `OCR Searchable PDF • ${ocrResults.length} Page(s) Embedded Text`,
          dataUrl: base64data,
        });
      };
      reader.readAsDataURL(blob);

      taskManager?.completeTask('Searchable PDF downloaded', 400);
      onAddToast({
        title: 'Searchable PDF Downloaded',
        description: 'Your searchable PDF with embedded text layer is ready.',
        type: 'success',
      });
    } catch (err: any) {
      console.error(err);
      onAddToast({
        title: 'Export Failed',
        description: err?.message || 'Could not generate Searchable PDF',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export DOCX
  const handleExportDocx = async () => {
    if (ocrResults.length === 0) return;
    setIsExporting(true);

    try {
      taskManager?.startTask('Generating Word Document...', 40, 'Formatting paragraphs and headings...');
      const blob = await generateOcrDocx(
        ocrResults,
        file ? file.name.replace(/\.[^/.]+$/, '') : 'OCR Extracted Document'
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file ? file.name.replace(/\.[^/.]+$/, '') : 'Document'}_OCR.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      taskManager?.completeTask('Word Document downloaded', 400);
      onAddToast({
        title: 'Word Document (.docx) Exported',
        description: 'Formatted Word document created successfully.',
        type: 'success',
      });
    } catch (err: any) {
      console.error(err);
      onAddToast({
        title: 'DOCX Export Failed',
        description: err?.message || 'Could not create Word file',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export TXT
  const handleExportTxt = () => {
    if (ocrResults.length === 0) return;

    const fullContent = ocrResults
      .map((p) => `========================================\nPAGE ${p.pageNumber} (Confidence: ${p.confidence}%)\n========================================\n\n${p.text}`)
      .join('\n\n\n');

    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file ? file.name.replace(/\.[^/.]+$/, '') : 'Document'}_OCR.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onAddToast({
      title: 'Text File (.txt) Downloaded',
      description: 'Raw extracted text exported.',
      type: 'success',
    });
  };

  // Export JSON
  const handleExportJson = () => {
    if (ocrResults.length === 0) return;

    const data = {
      filename: file?.name || 'document',
      extractedAt: new Date().toISOString(),
      language,
      totalPages: ocrResults.length,
      averageConfidence: Math.round(ocrResults.reduce((acc, p) => acc + p.confidence, 0) / ocrResults.length),
      entities: extractedEntities,
      pages: ocrResults.map((p) => ({
        pageNumber: p.pageNumber,
        confidence: p.confidence,
        text: p.text,
        linesCount: p.lines.length,
        lines: p.lines,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file ? file.name.replace(/\.[^/.]+$/, '') : 'Document'}_OCR_Structure.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onAddToast({
      title: 'Structured JSON Exported',
      description: 'Bounding boxes, words & confidence metrics downloaded.',
      type: 'success',
    });
  };

  // Copy text to clipboard
  const handleCopyText = (textToCopy?: string) => {
    const text = textToCopy || ocrResults.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    onAddToast({
      title: 'Copied to Clipboard',
      description: 'Extracted text copied to system clipboard.',
      type: 'success',
    });
  };

  const currentPage = ocrResults[selectedPageIndex];

  return (
    <div id="ocr-tool-container" className="flex flex-col gap-5">
      {/* Configuration & Upload Card */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-[#eaedff] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eaedff] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#e2e7ff] text-[#00236f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                document_scanner
              </span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-[17px] font-bold text-[#131b2e]">
                Optical Character Recognition (OCR) Engine
              </h3>
              <p className="text-[12px] text-[#757682]">
                Extract searchable text from scanned PDFs, marksheets, certificates, admit cards, or camera snapshots.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#85f8c4]/20 border border-[#85f8c4]/50 text-[#003120] text-[11px] font-bold">
              100% In-Browser Privacy
            </span>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#f8f9ff] p-3.5 rounded-xl border border-[#dae2fd]">
          {/* Language Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#131b2e] uppercase tracking-wider">
              Recognition Language
            </label>
            <select
              value={language}
              disabled={isProcessing}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-9 px-2 bg-white text-[#131b2e] font-semibold text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f] cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Max PDF Pages */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#131b2e] uppercase tracking-wider">
              PDF Page Range
            </label>
            <select
              value={maxPdfPages}
              disabled={isProcessing}
              onChange={(e) => setMaxPdfPages(parseInt(e.target.value, 10))}
              className="w-full h-9 px-2 bg-white text-[#131b2e] font-semibold text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f] cursor-pointer"
            >
              <option value={1}>First 1 Page (Fastest)</option>
              <option value={3}>First 3 Pages</option>
              <option value={5}>First 5 Pages (Standard)</option>
              <option value={10}>First 10 Pages</option>
              <option value={20}>First 20 Pages (Comprehensive)</option>
            </select>
          </div>

          {/* Auto-Orientation Detection */}
          <div className="flex flex-col justify-end gap-1">
            <label className="flex items-center gap-2 h-9 px-2.5 bg-white rounded-lg border border-[#dae2fd] cursor-pointer hover:bg-[#f2f3ff] transition-colors" title="Automatically detect document tilt/rotation (90°, 180°, 270°) and align upright before OCR extraction">
              <input
                type="checkbox"
                checked={autoOrient}
                disabled={isProcessing}
                onChange={(e) => setAutoOrient(e.target.checked)}
                className="w-4 h-4 rounded text-[#00236f] focus:ring-0 cursor-pointer"
              />
              <span className="text-[11.5px] font-bold text-[#131b2e] flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#00236f]">screen_rotation</span>
                <span>Auto-Orientation</span>
              </span>
            </label>
          </div>

          {/* Enhancement Toggle */}
          <div className="flex flex-col justify-end gap-1">
            <label className="flex items-center gap-2 h-9 px-2.5 bg-white rounded-lg border border-[#dae2fd] cursor-pointer hover:bg-[#f2f3ff] transition-colors">
              <input
                type="checkbox"
                checked={enhanceScan}
                disabled={isProcessing}
                onChange={(e) => setEnhanceScan(e.target.checked)}
                className="w-4 h-4 rounded text-[#00236f] focus:ring-0 cursor-pointer"
              />
              <span className="text-[11.5px] font-bold text-[#131b2e]">
                Auto-Enhance Contrast
              </span>
            </label>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              disabled={!file || isProcessing}
              onClick={handleRunOcr}
              className={`w-full h-9 rounded-lg font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                !file || isProcessing
                  ? 'bg-[#e2e7ff] text-[#757682] cursor-not-allowed'
                  : 'bg-[#00236f] hover:bg-[#1e3a8a] text-white shadow-sm hover:shadow'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isProcessing ? 'hourglass_empty' : 'play_arrow'}
              </span>
              <span>{isProcessing ? 'Extracting Text...' : 'Start OCR Extraction'}</span>
            </button>
          </div>
        </div>

        {/* File Dropzone */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp,image/bmp,image/tiff"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        {!file ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#dae2fd] hover:border-[#00236f] bg-[#f8f9ff] hover:bg-[#f2f3ff] rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#e2e7ff] text-[#00236f] flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px]">
                upload_file
              </span>
            </div>
            <div>
              <p className="font-['Outfit'] text-[16px] font-bold text-[#131b2e]">
                Click to browse or drag &amp; drop document / scanned image
              </p>
              <p className="text-[12px] text-[#757682] mt-0.5">
                Supports Scanned PDFs, Marksheets, Caste/Income Certificates, Admit Cards, JPG, PNG &amp; WEBP
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              <span className="px-2 py-0.5 bg-white rounded border border-[#dae2fd] text-[11px] font-mono text-[#444651]">
                PDF Documents
              </span>
              <span className="px-2 py-0.5 bg-white rounded border border-[#dae2fd] text-[11px] font-mono text-[#444651]">
                JPG / PNG Scans
              </span>
              <span className="px-2 py-0.5 bg-white rounded border border-[#dae2fd] text-[11px] font-mono text-[#444651]">
                Hindi &amp; English
              </span>
            </div>

            {onNavigate && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('camera-scanner');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#e2e7ff] hover:bg-[#d5deff] text-[#00236f] text-[12px] font-bold inline-flex items-center gap-2 transition-all cursor-pointer border border-[#b4c5ff] shadow-sm hover:scale-[1.02]"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  <span>Capture &amp; Scan with Mobile Camera</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#f2f3ff] rounded-xl p-4 border border-[#dae2fd] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00236f] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">
                  {file.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                </span>
              </div>
              <div>
                <h4 className="font-bold text-[14px] text-[#131b2e] line-clamp-1">
                  {file.name}
                </h4>
                <p className="text-[12px] text-[#757682]">
                  Size: {(file.size / 1024).toFixed(1)} KB • Type: {file.type || 'Document'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-white text-[#00236f] font-semibold text-[12px] border border-[#dae2fd] hover:bg-[#e2e7ff] transition-colors cursor-pointer"
              >
                Change File
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setFile(null);
                  setOcrResults([]);
                  setProgressInfo(null);
                }}
                className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-[#ffdcc3]/40 transition-colors cursor-pointer"
                title="Remove file"
              >
                <span className="material-symbols-outlined text-[20px]">
                  delete
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Real-time Progress Bar */}
        {isProcessing && progressInfo && (
          <div className="bg-[#e2e7ff]/40 p-4 rounded-xl border border-[#dae2fd] flex flex-col gap-2">
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="font-bold text-[#00236f] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00236f] animate-ping"></span>
                <span>{progressInfo.status}</span>
              </span>
              <span className="font-mono font-bold text-[#00236f]">
                {Math.round(progressInfo.progress * 100)}%
              </span>
            </div>
            
            <div className="w-full h-2 bg-[#dae2fd] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00236f] transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(5, progressInfo.progress * 100))}%` }}
              ></div>
            </div>

            <p className="text-[11.5px] text-[#444651] italic">
              {progressInfo.currentStage}
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* OCR RESULTS DASHBOARD & EXPORT SUITE */}
      {/* ========================================================================= */}
      {ocrResults.length > 0 && currentPage && (
        <div className="bg-white rounded-xl shadow-sm border border-[#eaedff] flex flex-col overflow-hidden">
          {/* Top Bar with Export Buttons & Page Switcher */}
          <div className="p-4 border-b border-[#eaedff] bg-[#faf8ff] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-[#444651] uppercase tracking-wider">
                  Pages ({ocrResults.length}):
                </span>
                <div className="flex items-center gap-1">
                  {ocrResults.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPageIndex(idx)}
                      className={`w-8 h-8 rounded-lg font-mono font-bold text-[12px] transition-all cursor-pointer ${
                        selectedPageIndex === idx
                          ? 'bg-[#00236f] text-white shadow-xs'
                          : 'bg-white text-[#444651] border border-[#dae2fd] hover:bg-[#eaedff]'
                      }`}
                    >
                      {p.pageNumber}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Badge */}
              <span className="px-2.5 py-1 rounded-md bg-[#85f8c4]/20 border border-[#85f8c4]/50 text-[#003120] text-[11px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  verified
                </span>
                <span>Page {currentPage.pageNumber} Confidence: {currentPage.confidence}%</span>
              </span>

              {/* Orientation Detection Badge */}
              {currentPage.autoRotated ? (
                <span
                  className="px-2.5 py-1 rounded-md bg-[#e2e7ff] border border-[#b9c3f8] text-[#00236f] text-[11px] font-bold flex items-center gap-1"
                  title={currentPage.orientationLabel || `Auto-rotated ${currentPage.detectedOrientation}°`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    screen_rotation
                  </span>
                  <span>Auto-Rotated {currentPage.detectedOrientation}° ({currentPage.orientationConfidence || 95}% AI Conf)</span>
                </span>
              ) : (
                <span
                  className="px-2.5 py-1 rounded-md bg-[#f2f3ff] border border-[#dae2fd] text-[#444651] text-[11px] font-semibold flex items-center gap-1"
                  title="Document orientation verified upright (0°)"
                >
                  <span className="material-symbols-outlined text-[14px] text-[#006e33]">
                    check_circle
                  </span>
                  <span>Orientation: Upright (0°)</span>
                </span>
              )}
            </div>

            {/* Main Export Toolbar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Searchable PDF Button */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleExportSearchablePdf('scanned-with-text-layer')}
                className="px-3 py-1.5 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[12px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Export original scan with an embedded searchable text layer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  picture_as_pdf
                </span>
                <span>Searchable PDF</span>
              </button>

              {/* Word DOCX Button */}
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportDocx}
                className="px-3 py-1.5 rounded-lg bg-white text-[#00236f] font-bold text-[12px] border border-[#dae2fd] hover:bg-[#eaedff] transition-all flex items-center gap-1.5 cursor-pointer"
                title="Export as Microsoft Word Document (.docx)"
              >
                <span className="material-symbols-outlined text-[16px]">
                  article
                </span>
                <span>Word (.docx)</span>
              </button>

              {/* Text TXT Button */}
              <button
                type="button"
                onClick={handleExportTxt}
                className="px-2.5 py-1.5 rounded-lg bg-white text-[#444651] font-semibold text-[12px] border border-[#dae2fd] hover:bg-[#eaedff] transition-all flex items-center gap-1 cursor-pointer"
                title="Export as Plain Text (.txt)"
              >
                <span className="material-symbols-outlined text-[16px]">
                  description
                </span>
                <span>.TXT</span>
              </button>

              {/* Copy Button */}
              <button
                type="button"
                onClick={() => handleCopyText()}
                className="px-2.5 py-1.5 rounded-lg bg-white text-[#444651] font-semibold text-[12px] border border-[#dae2fd] hover:bg-[#eaedff] transition-all flex items-center gap-1 cursor-pointer"
                title="Copy all extracted text to clipboard"
              >
                <span className="material-symbols-outlined text-[16px]">
                  content_copy
                </span>
                <span>Copy</span>
              </button>

              {/* JSON Structure */}
              <button
                type="button"
                onClick={handleExportJson}
                className="px-2 py-1.5 rounded-lg bg-white text-[#757682] hover:text-[#131b2e] font-semibold text-[12px] border border-[#dae2fd] hover:bg-[#eaedff] transition-all cursor-pointer"
                title="Download full JSON structure with coordinates"
              >
                <span className="material-symbols-outlined text-[16px]">
                  code
                </span>
              </button>
            </div>
          </div>

          {/* Sub Navigation Bar: Text Editor vs Extracted Govt Entities vs Visual Bounding Boxes */}
          <div className="px-4 py-2 bg-white border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'editor'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#444651] hover:bg-[#eaedff]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  edit_note
                </span>
                <span>Text Editor &amp; Formatter</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('entities')}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'entities'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#444651] hover:bg-[#eaedff]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  badge
                </span>
                <span>Extracted Entities ({extractedEntities.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#f2f3ff] text-[#444651] hover:bg-[#eaedff]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  view_in_ar
                </span>
                <span>Visual OCR Inspector</span>
              </button>
            </div>

            {/* In-Text Quick Search */}
            <div className="relative min-w-[200px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#757682] text-[16px]">
                search
              </span>
              <input
                type="text"
                value={searchWord}
                onChange={(e) => setSearchWord(e.target.value)}
                placeholder="Search in extracted text..."
                className="w-full h-8 pl-8 pr-3 bg-[#f8f9ff] text-[12px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
              />
            </div>
          </div>

          {/* TAB 1: TEXT EDITOR & FORMATTER */}
          {activeTab === 'editor' && (
            <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Original Page Canvas Thumbnail (4 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[12px] font-bold text-[#444651]">
                  <span>Scanned Page {currentPage.pageNumber} Reference</span>
                  <span className="font-mono text-[#757682]">
                    {currentPage.imageWidth} × {currentPage.imageHeight} px
                  </span>
                </div>

                <div className="bg-[#131b2e] rounded-xl overflow-hidden border border-[#dae2fd] max-h-[500px] flex items-center justify-center p-2 relative group">
                  <img
                    src={currentPage.imageDataUrl}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="max-h-[480px] w-auto object-contain rounded shadow"
                  />
                  <a
                    href={currentPage.imageDataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-[#131b2e] text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow flex items-center gap-1 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      open_in_new
                    </span>
                    <span>View Full Scan</span>
                  </a>
                </div>

                {/* Page Manual Rotation & Orientation Controls */}
                <div className="flex items-center justify-between bg-[#f8f9ff] p-2.5 rounded-xl border border-[#dae2fd] text-[12px]">
                  <div className="flex items-center gap-1.5 text-[#444651] font-semibold text-[11.5px]">
                    <span className="material-symbols-outlined text-[16px] text-[#00236f]">
                      rotate_right
                    </span>
                    <span>Adjust Alignment:</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isReorienting || isProcessing}
                      onClick={() => handleManualRotatePage(270)}
                      className="px-2 py-1 bg-white hover:bg-[#eaedff] text-[#00236f] border border-[#dae2fd] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      title="Rotate 90° Counter-Clockwise and re-extract text"
                    >
                      <span className="material-symbols-outlined text-[14px]">rotate_left</span>
                      <span>90° CCW</span>
                    </button>

                    <button
                      type="button"
                      disabled={isReorienting || isProcessing}
                      onClick={() => handleManualRotatePage(90)}
                      className="px-2 py-1 bg-white hover:bg-[#eaedff] text-[#00236f] border border-[#dae2fd] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      title="Rotate 90° Clockwise and re-extract text"
                    >
                      <span className="material-symbols-outlined text-[14px]">rotate_right</span>
                      <span>90° CW</span>
                    </button>

                    <button
                      type="button"
                      disabled={isReorienting || isProcessing}
                      onClick={() => handleManualRotatePage(180)}
                      className="px-2 py-1 bg-white hover:bg-[#eaedff] text-[#00236f] border border-[#dae2fd] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                      title="Rotate 180° (Upside down flip) and re-extract text"
                    >
                      <span className="material-symbols-outlined text-[14px]">sync</span>
                      <span>180°</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Editable Text Area (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-bold text-[#131b2e]">
                    Editable Extracted Content (Page {currentPage.pageNumber})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Quick clean: strip extra spaces & blank lines
                        const cleaned = currentPage.text
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .join('\n');
                        handlePageTextChange(cleaned);
                      }}
                      className="text-[11px] font-semibold text-[#00236f] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        auto_fix_high
                      </span>
                      <span>Clean Whitespace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(currentPage.text)}
                      className="text-[11px] font-semibold text-[#00236f] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        content_copy
                      </span>
                      <span>Copy Page</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={currentPage.text}
                  onChange={(e) => handlePageTextChange(e.target.value)}
                  placeholder="Extracted OCR text will appear here. You can freely edit or format it before exporting."
                  rows={18}
                  className="w-full p-3.5 bg-[#f8f9ff] text-[#131b2e] font-mono text-[12.5px] leading-relaxed rounded-xl border border-[#dae2fd] focus:outline-none focus:border-[#00236f] resize-y"
                />

                <div className="flex items-center justify-between text-[11px] text-[#757682] px-1">
                  <span>
                    Lines: {currentPage.lines.length} • Characters: {currentPage.text.length}
                  </span>
                  <span>
                    OCR Engine: Tesseract AI ({language.toUpperCase()})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXTRACTED GOVT ENTITIES */}
          {activeTab === 'entities' && (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-['Outfit'] text-[16px] font-bold text-[#131b2e]">
                    Smart Government Entity &amp; ID Extractor
                  </h4>
                  <p className="text-[12px] text-[#757682]">
                    Automatically recognized Aadhaar, PAN, Dates of Birth, Roll Numbers, Contact details from this scan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const str = extractedEntities.map((e) => `${e.label}: ${e.value}`).join('\n');
                    handleCopyText(str);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    content_copy
                  </span>
                  <span>Copy All Entities</span>
                </button>
              </div>

              {extractedEntities.length === 0 ? (
                <div className="bg-[#f8f9ff] p-8 rounded-xl border border-[#dae2fd] text-center flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[40px] text-[#757682]">
                    find_replace
                  </span>
                  <p className="font-bold text-[14px] text-[#131b2e]">
                    No standard PAN, Aadhaar or Roll Number patterns detected
                  </p>
                  <p className="text-[12px] text-[#757682] max-w-sm">
                    You can still copy or export the full recognized text from the Text Editor tab.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {extractedEntities.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#f8f9ff] p-3.5 rounded-xl border border-[#dae2fd] flex flex-col justify-between gap-2 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">
                          {item.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.category === 'id'
                              ? 'bg-[#dce1ff] text-[#00236f]'
                              : item.category === 'date'
                              ? 'bg-[#85f8c4]/30 text-[#003120]'
                              : 'bg-[#ffdcc3]/40 text-[#904d00]'
                          }`}
                        >
                          {item.category}
                        </span>
                      </div>

                      <div className="font-mono text-[14px] font-bold text-[#131b2e] break-all bg-white p-2 rounded-lg border border-[#dae2fd]">
                        {item.value}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.value);
                          onAddToast({
                            title: 'Value Copied',
                            description: `Copied "${item.value}" to clipboard.`,
                            type: 'success',
                          });
                        }}
                        className="w-full py-1 rounded bg-[#e2e7ff] hover:bg-[#dce1ff] text-[#00236f] text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          content_copy
                        </span>
                        <span>Copy Value</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VISUAL OCR INSPECTOR (BOUNDING BOXES) */}
          {activeTab === 'preview' && (
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[12px] font-bold text-[#131b2e] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBoundingBoxes}
                      onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                      className="w-4 h-4 rounded text-[#00236f]"
                    />
                    <span>Highlight Recognized Line Boxes</span>
                  </label>

                  {/* Quick Rotation Buttons in Inspector */}
                  <div className="flex items-center gap-1 border-l border-[#dae2fd] pl-3">
                    <button
                      type="button"
                      disabled={isReorienting || isProcessing}
                      onClick={() => handleManualRotatePage(270)}
                      className="px-2 py-0.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#00236f] border border-[#dae2fd] rounded text-[11px] font-bold flex items-center gap-0.5 transition-all disabled:opacity-50 cursor-pointer"
                      title="Rotate 90° CCW"
                    >
                      <span className="material-symbols-outlined text-[13px]">rotate_left</span>
                      <span>90° CCW</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReorienting || isProcessing}
                      onClick={() => handleManualRotatePage(90)}
                      className="px-2 py-0.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#00236f] border border-[#dae2fd] rounded text-[11px] font-bold flex items-center gap-0.5 transition-all disabled:opacity-50 cursor-pointer"
                      title="Rotate 90° CW"
                    >
                      <span className="material-symbols-outlined text-[13px]">rotate_right</span>
                      <span>90° CW</span>
                    </button>
                    <button
                      type="button"
                      disabled={isReorienting || isProcessing}
                      onClick={() => handleManualRotatePage(180)}
                      className="px-2 py-0.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#00236f] border border-[#dae2fd] rounded text-[11px] font-bold flex items-center gap-0.5 transition-all disabled:opacity-50 cursor-pointer"
                      title="Rotate 180°"
                    >
                      <span className="material-symbols-outlined text-[13px]">sync</span>
                      <span>180°</span>
                    </button>
                  </div>
                </div>

                <p className="text-[12px] text-[#757682]">
                  Click on any detected line box to quickly copy that specific text snippet.
                </p>
              </div>

              {/* Canvas Overlay Container */}
              <div className="bg-[#131b2e] rounded-xl p-4 flex items-center justify-center overflow-auto max-h-[600px]">
                <div className="relative inline-block">
                  <img
                    src={currentPage.imageDataUrl}
                    alt="Scan"
                    className="max-h-[550px] w-auto object-contain rounded"
                  />

                  {/* Bounding box overlays */}
                  {showBoundingBoxes &&
                    currentPage.lines.map((line, idx) => {
                      const scaleX = 100 / currentPage.imageWidth;
                      const scaleY = 100 / currentPage.imageHeight;
                      const left = line.bbox.x0 * scaleX;
                      const top = line.bbox.y0 * scaleY;
                      const width = (line.bbox.x1 - line.bbox.x0) * scaleX;
                      const height = (line.bbox.y1 - line.bbox.y0) * scaleY;

                      const isMatch =
                        searchWord.trim() && line.text.toLowerCase().includes(searchWord.toLowerCase());

                      return (
                        <div
                          key={idx}
                          title={`${line.text} (${line.confidence}% confidence) - Click to copy`}
                          onClick={() => {
                            navigator.clipboard.writeText(line.text);
                            onAddToast({
                              title: 'Line Copied',
                              description: `Copied: "${line.text}"`,
                              type: 'success',
                            });
                          }}
                          className={`absolute border cursor-pointer transition-all hover:bg-blue-500/30 ${
                            isMatch
                              ? 'border-yellow-400 bg-yellow-400/40 z-20 ring-2 ring-yellow-400'
                              : 'border-blue-400/60 bg-blue-500/10 hover:border-blue-300'
                          }`}
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                          }}
                        />
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Summary Bar */}
          <div className="bg-[#faf8ff] p-3.5 border-t border-[#eaedff] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#444651]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00236f] text-[18px]">
                info
              </span>
              <span>
                Exporting Searchable PDF preserves 100% original visual layout with a selectable text layer underneath.
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setFile(null);
                setOcrResults([]);
                setProgressInfo(null);
              }}
              className="text-[#ba1a1a] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">
                refresh
              </span>
              <span>Scan Another Document</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
