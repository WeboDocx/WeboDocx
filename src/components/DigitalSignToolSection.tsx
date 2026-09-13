import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ToastMessage, TaskManager } from '../types';
import { renderPdfPageToImage, getPdfInfo } from '../utils/pdfConverter';
import {
  processSignatureImage,
  stampSignatureOnPdf,
  SignaturePosition,
} from '../utils/pdfSigner';
import { recordRecentActivity } from '../utils/recentActivityStore';

interface DigitalSignToolSectionProps {
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
}

type SignatureSource = 'upload' | 'draw';

export const DigitalSignToolSection: React.FC<DigitalSignToolSectionProps> = ({
  onAddToast,
  taskManager,
}) => {
  // PDF Document State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageRendering, setPageRendering] = useState<boolean>(false);
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }>({
    width: 595,
    height: 842,
  });

  // Target Page for Signing
  const [signTargetPage, setSignTargetPage] = useState<number | 'all'>(1);

  // Signature Source State
  const [signatureSource, setSignatureSource] = useState<SignatureSource>('upload');
  const [rawSignatureUrl, setRawSignatureUrl] = useState<string | null>(null);
  const [processedSignatureUrl, setProcessedSignatureUrl] = useState<string | null>(null);
  const [signatureDims, setSignatureDims] = useState<{ width: number; height: number }>({
    width: 150,
    height: 60,
  });

  // Image Processing Controls
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [bgThreshold, setBgThreshold] = useState<number>(215);
  const [inkEnhancement, setInkEnhancement] = useState<'original' | 'dark-blue' | 'black'>('dark-blue');

  // Drawing Pad State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawColor, setDrawColor] = useState<'#00236f' | '#131b2e'>('#00236f');
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);

  // Overlay Placement & Dimensions (relative percentages 0-100)
  const [position, setPosition] = useState<SignaturePosition>({
    xPercent: 65, // Bottom right default
    yPercent: 82,
    widthPercent: 24,
    heightPercent: 9,
  });

  // Additional Attestation Details
  const [attestationType, setAttestationType] = useState<string>('Self Attested');
  const [signatoryName, setSignatoryName] = useState<string>('');
  const [includeDate, setIncludeDate] = useState<boolean>(true);
  const [dateString, setDateString] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB'); // DD/MM/YYYY
  });
  const [includeTimestamp, setIncludeTimestamp] = useState<boolean>(false);

  // Processing & Export State
  const [isStamping, setIsStamping] = useState<boolean>(false);
  const [signedResultBlob, setSignedResultBlob] = useState<Blob | null>(null);
  const [signedResultUrl, setSignedResultUrl] = useState<string | null>(null);
  const [signedResultStats, setSignedResultStats] = useState<{ sizeKb: number; pages: number } | null>(null);

  // Interactive Dragging & Resizing Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const isDraggingRef = useRef<boolean>(false);
  const isResizingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startXPercent: number; startYPercent: number }>({
    mouseX: 0,
    mouseY: 0,
    startXPercent: 0,
    startYPercent: 0,
  });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startWPercent: number; startHPercent: number }>({
    mouseX: 0,
    mouseY: 0,
    startWPercent: 0,
    startHPercent: 0,
  });

  // =========================================================================
  // 1. PDF File Loader
  // =========================================================================
  const loadPdfFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      onAddToast({
        title: 'Invalid File Format',
        description: 'Please upload a valid PDF document to add your digital signature.',
        type: 'error',
      });
      return;
    }

    try {
      taskManager?.startTask(`Loading PDF ${file.name}`, 30, 'Parsing PDF structure & rendering preview...');
      setPdfFile(file);
      setSignedResultBlob(null);
      if (signedResultUrl) {
        URL.revokeObjectURL(signedResultUrl);
        setSignedResultUrl(null);
      }

      const buffer = await file.arrayBuffer();
      setPdfBuffer(buffer);

      const info = await getPdfInfo(buffer);
      setTotalPages(info.numPages || 1);
      setCurrentPage(1);
      setSignTargetPage(1);

      await renderPage(buffer, 1);
      taskManager?.completeTask(`Loaded PDF (${info.numPages} pages)`, 400);

      onAddToast({
        title: 'PDF Document Loaded',
        description: `${file.name} (${info.numPages} pages) ready. Upload your signature to place on page 1.`,
        type: 'info',
      });
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      taskManager?.failTask(`Failed to load PDF: ${err?.message || 'Unknown error'}`);
      onAddToast({
        title: 'Failed to Load PDF',
        description: `Could not read PDF: ${err?.message || 'Protected or corrupted file'}`,
        type: 'error',
      });
    }
  }, [onAddToast, taskManager, signedResultUrl]);

  // Check for pending PDF from Camera Scanner
  useEffect(() => {
    const pendingSignPdf = sessionStorage.getItem('WEBODOCX_PENDING_SIGN_PDF');
    const pendingSignName = sessionStorage.getItem('WEBODOCX_PENDING_SIGN_NAME') || 'Scanned_Document.pdf';
    if (pendingSignPdf) {
      sessionStorage.removeItem('WEBODOCX_PENDING_SIGN_PDF');
      sessionStorage.removeItem('WEBODOCX_PENDING_SIGN_NAME');
      fetch(pendingSignPdf)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], pendingSignName, { type: 'application/pdf' });
          loadPdfFile(file);
        })
        .catch((err) => console.warn('Pending Sign PDF load error:', err));
    }
  }, [loadPdfFile]);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    loadPdfFile(files[0]);
  };

  const renderPage = async (buffer: ArrayBuffer, pageNum: number) => {
    setPageRendering(true);
    try {
      const { dataUrl, width, height } = await renderPdfPageToImage(buffer, pageNum, 'image/jpeg', 1.6);
      setPageDataUrl(dataUrl);
      setPageDimensions({ width, height });
    } catch (err) {
      console.error('Page render error:', err);
    } finally {
      setPageRendering(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!pdfBuffer || newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (signTargetPage !== 'all') {
      setSignTargetPage(newPage);
    }
    await renderPage(pdfBuffer, newPage);
  };

  // =========================================================================
  // 2. Signature Image Processing
  // =========================================================================
  const processCurrentSignature = useCallback(
    async (rawUrl: string, removeBgFlag: boolean, threshold: number, ink: 'original' | 'dark-blue' | 'black') => {
      try {
        const { dataUrl, width, height } = await processSignatureImage(rawUrl, {
          removeBackground: removeBgFlag,
          bgThreshold: threshold,
          inkColor: ink,
          cropExcessWhitespace: true,
        });
        setProcessedSignatureUrl(dataUrl);
        setSignatureDims({ width, height });

        // Maintain aspect ratio in position percentage
        const aspect = width / height;
        setPosition((prev) => {
          const w = prev.widthPercent;
          const h = Math.min(30, Math.max(4, Math.round(w / (aspect * 1.4))));
          return { ...prev, heightPercent: h };
        });
      } catch (err) {
        console.error('Signature process error:', err);
        setProcessedSignatureUrl(rawUrl);
      }
    },
    []
  );

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (!file.type.startsWith('image/')) {
      onAddToast({
        title: 'Image Required',
        description: 'Please upload a signature scan (PNG, JPG, JPEG, WebP).',
        type: 'error',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setRawSignatureUrl(dataUrl);
      await processCurrentSignature(dataUrl, removeBg, bgThreshold, inkEnhancement);
      onAddToast({
        title: 'Signature Loaded',
        description: 'Auto-cleaned signature background. Drag on the preview to position it on your document.',
        type: 'success',
      });
    };
    reader.readAsDataURL(file);
  };

  // Re-process when filter sliders change
  useEffect(() => {
    if (rawSignatureUrl) {
      processCurrentSignature(rawSignatureUrl, removeBg, bgThreshold, inkEnhancement);
    }
  }, [removeBg, bgThreshold, inkEnhancement, rawSignatureUrl, processCurrentSignature]);

  // =========================================================================
  // 3. Drawing Pad Canvas Helpers
  // =========================================================================
  const initDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasDrawn(false);
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setRawSignatureUrl(dataUrl);
    setProcessedSignatureUrl(dataUrl);
  };

  const clearDrawPad = () => {
    initDrawCanvas();
    if (signatureSource === 'draw') {
      setRawSignatureUrl(null);
      setProcessedSignatureUrl(null);
    }
  };

  // =========================================================================
  // 4. Interactive Drag & Resize Handlers on Preview Canvas
  // =========================================================================
  const handleMouseDownOnStamp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startXPercent: position.xPercent,
      startYPercent: position.yPercent,
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseDownOnResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startWPercent: position.widthPercent,
      startHPercent: position.heightPercent,
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (isDraggingRef.current) {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;

      setPosition((prev) => {
        const maxX = 100 - prev.widthPercent;
        const maxY = 100 - prev.heightPercent;
        return {
          ...prev,
          xPercent: Math.max(0, Math.min(maxX, dragStartRef.current.startXPercent + deltaXPercent)),
          yPercent: Math.max(0, Math.min(maxY, dragStartRef.current.startYPercent + deltaYPercent)),
        };
      });
    } else if (isResizingRef.current) {
      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;

      const deltaWPercent = (deltaX / rect.width) * 100;
      const deltaHPercent = (deltaY / rect.height) * 100;

      setPosition((prev) => {
        const newW = Math.max(8, Math.min(100 - prev.xPercent, resizeStartRef.current.startWPercent + deltaWPercent));
        const newH = Math.max(4, Math.min(100 - prev.yPercent, resizeStartRef.current.startHPercent + deltaHPercent));
        return {
          ...prev,
          widthPercent: newW,
          heightPercent: newH,
        };
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  // Preset alignment buttons
  const applyPresetAlignment = (preset: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'center') => {
    setPosition((prev) => {
      switch (preset) {
        case 'bottom-right':
          return { ...prev, xPercent: 100 - prev.widthPercent - 4, yPercent: 100 - prev.heightPercent - 6 };
        case 'bottom-left':
          return { ...prev, xPercent: 4, yPercent: 100 - prev.heightPercent - 6 };
        case 'bottom-center':
          return { ...prev, xPercent: (100 - prev.widthPercent) / 2, yPercent: 100 - prev.heightPercent - 6 };
        case 'top-right':
          return { ...prev, xPercent: 100 - prev.widthPercent - 4, yPercent: 6 };
        case 'center':
          return { ...prev, xPercent: (100 - prev.widthPercent) / 2, yPercent: (100 - prev.heightPercent) / 2 };
        default:
          return prev;
      }
    });
  };

  // =========================================================================
  // 5. PDF Signature Stamping & Download Execution
  // =========================================================================
  const handleExecuteSign = async () => {
    if (!pdfBuffer || !pdfFile) {
      onAddToast({
        title: 'PDF Missing',
        description: 'Please upload a PDF document to sign.',
        type: 'error',
      });
      return;
    }

    if (!processedSignatureUrl) {
      onAddToast({
        title: 'Signature Missing',
        description: 'Please upload an image of your signature or draw one in the signature pad.',
        type: 'error',
      });
      return;
    }

    setIsStamping(true);
    const targetPageLabel = signTargetPage === 'all' ? `all ${totalPages} pages` : `page ${signTargetPage}`;
    taskManager?.startTask(
      `Digitally Stamping Signature onto ${targetPageLabel}`,
      30,
      'Embedding high-precision transparent vector stamp & metadata...'
    );

    try {
      const targetPageNum = signTargetPage === 'all' ? -1 : signTargetPage;

      const { signedBlob, totalPages: pageCount, sizeKb } = await stampSignatureOnPdf(pdfBuffer, {
        signatureDataUrl: processedSignatureUrl,
        pageNumber: targetPageNum,
        position,
        dateText: includeDate ? dateString : undefined,
        signatoryName: signatoryName.trim() || undefined,
        attestationNote: attestationType === 'None' ? undefined : attestationType,
        includeTimestamp,
      });

      setSignedResultBlob(signedBlob);
      const url = URL.createObjectURL(signedBlob);
      setSignedResultUrl(url);
      setSignedResultStats({ sizeKb, pages: pageCount });

      // Trigger automatic download
      const originalName = pdfFile.name.replace(/\.pdf$/i, '');
      const downloadName = `Signed_${originalName}.pdf`;
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
          category: 'digital-sign',
          fileType: 'pdf',
          sizeKb,
          originalSizeKb: Math.round(pdfFile.size / 1024),
          details: `Digitally Attested • ${targetPageLabel} (${pageCount} Pages)`,
          dataUrl: base64data,
        });
      };
      reader.readAsDataURL(signedBlob);

      taskManager?.completeTask(`Signed PDF generated (${sizeKb} KB)`, 500);

      onAddToast({
        title: 'PDF Digitally Signed!',
        description: `Your signature was successfully placed on ${targetPageLabel}. Download started automatically.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Error stamping PDF:', err);
      taskManager?.failTask(`Signature stamping failed: ${err?.message || 'Unknown error'}`);
      onAddToast({
        title: 'Stamping Failed',
        description: `Could not stamp signature: ${err?.message || 'PDF may be password protected'}`,
        type: 'error',
      });
    } finally {
      setIsStamping(false);
    }
  };

  return (
    <div id="digital-sign-section" className="flex flex-col gap-6">
      {/* Top Description Banner */}
      <div className="bg-[#f2f3ff] rounded-xl p-4 border border-[#dae2fd] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00236f] text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[22px]">ink_pen</span>
          </div>
          <div>
            <h3 className="font-['Outfit'] text-[17px] font-bold text-[#131b2e]">
              Digital Signature &amp; Self-Attestation Tool
            </h3>
            <p className="text-[12.5px] text-[#444651]">
              Place your official signature, date &amp; self-declaration tag onto any page of your PDF forms, admit cards &amp; certificates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-full bg-white text-[#00236f] text-[11.5px] font-bold border border-[#dae2fd] shadow-2xs flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-[#003120]">verified</span>
            100% In-Browser Privacy
          </span>
        </div>
      </div>

      {/* Main 2-Column Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: PDF & Signature Input Controls (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* 1. PDF Document Upload Card */}
          <div className="bg-white rounded-xl p-5 border border-[#eaedff] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#00236f] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#e2e7ff] text-[#00236f] flex items-center justify-center text-[11px] font-extrabold">
                  1
                </span>
                PDF Document
              </span>
              {pdfFile && (
                <span className="text-[11px] text-[#004a32] font-semibold bg-[#85f8c4]/25 px-2 py-0.5 rounded-md">
                  {totalPages} Page{totalPages > 1 ? 's' : ''} Loaded
                </span>
              )}
            </div>

            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfChange}
              className="hidden"
            />

            {!pdfFile ? (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#dae2fd] hover:border-[#00236f] bg-[#f8fafc] hover:bg-[#f2f3ff] rounded-xl p-6 flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#e2e7ff] group-hover:bg-[#00236f] text-[#00236f] group-hover:text-white flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[26px]">upload_file</span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#131b2e]">Upload PDF Document</p>
                  <p className="text-[12px] text-[#757682] mt-0.5">
                    Click to select admit card, declaration form or affidavit PDF
                  </p>
                </div>
                <span className="px-3 py-1 rounded-lg bg-white border border-[#dae2fd] text-[11.5px] font-semibold text-[#00236f] shadow-2xs">
                  Choose PDF File
                </span>
              </button>
            ) : (
              <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#dae2fd] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#131b2e] truncate">{pdfFile.name}</p>
                    <p className="text-[11px] text-[#757682]">
                      {Math.round(pdfFile.size / 1024)} KB • {totalPages} Page{totalPages > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#eaedff] text-[#00236f] text-[12px] font-semibold border border-[#dae2fd] shrink-0 transition-colors cursor-pointer"
                >
                  Replace
                </button>
              </div>
            )}

            {/* Target Page Selector if PDF is loaded */}
            {pdfFile && totalPages > 1 && (
              <div className="mt-4 pt-3 border-t border-[#eaedff] flex items-center justify-between gap-3 flex-wrap">
                <label className="text-[12px] font-semibold text-[#444651]">
                  Place Signature on:
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={signTargetPage === 'all' ? 'all' : signTargetPage}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'all') {
                        setSignTargetPage('all');
                      } else {
                        const p = parseInt(val, 10);
                        setSignTargetPage(p);
                        handlePageChange(p);
                      }
                    }}
                    className="bg-white border border-[#dae2fd] text-[#131b2e] text-[12px] font-medium rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-[#00236f]"
                  >
                    {Array.from({ length: totalPages }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Page {i + 1} only
                      </option>
                    ))}
                    <option value="all">All Pages (1 to {totalPages})</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 2. Signature Creation / Upload Card */}
          <div className="bg-white rounded-xl p-5 border border-[#eaedff] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[#00236f] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#e2e7ff] text-[#00236f] flex items-center justify-center text-[11px] font-extrabold">
                  2
                </span>
                Signature Source
              </span>

              {/* Source Switcher: Upload vs Draw */}
              <div className="flex items-center bg-[#f2f3ff] p-0.5 rounded-lg border border-[#dae2fd]">
                <button
                  type="button"
                  onClick={() => setSignatureSource('upload')}
                  className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-all cursor-pointer ${
                    signatureSource === 'upload'
                      ? 'bg-white text-[#00236f] shadow-2xs'
                      : 'text-[#444651] hover:text-[#131b2e]'
                  }`}
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignatureSource('draw');
                    setTimeout(initDrawCanvas, 50);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-all cursor-pointer ${
                    signatureSource === 'draw'
                      ? 'bg-white text-[#00236f] shadow-2xs'
                      : 'text-[#444651] hover:text-[#131b2e]'
                  }`}
                >
                  Draw Pad
                </button>
              </div>
            </div>

            <input
              ref={signatureInputRef}
              type="file"
              accept="image/*"
              onChange={handleSignatureUpload}
              className="hidden"
            />

            {signatureSource === 'upload' ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="w-full border border-dashed border-[#dae2fd] hover:border-[#00236f] bg-[#f8fafc] hover:bg-[#f2f3ff] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[24px] text-[#00236f]">add_photo_alternate</span>
                  <p className="text-[13px] font-bold text-[#131b2e]">Upload Signature Image</p>
                  <p className="text-[11px] text-[#757682]">Supports JPG, PNG, WebP scan or photo</p>
                </button>

                {/* Signature Preview & Background Clean Settings */}
                {rawSignatureUrl && (
                  <div className="bg-[#f8fafc] rounded-xl p-3.5 border border-[#dae2fd] flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#444651] uppercase tracking-wider">
                        Signature Preview
                      </span>
                      <button
                        type="button"
                        onClick={() => signatureInputRef.current?.click()}
                        className="text-[11.5px] text-[#00236f] hover:underline font-semibold cursor-pointer"
                      >
                        Change Image
                      </button>
                    </div>

                    {/* Preview Box with Checkered Background */}
                    <div
                      className="h-20 rounded-lg flex items-center justify-center p-2 border border-[#dae2fd]"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                        backgroundSize: '12px 12px',
                        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                      }}
                    >
                      {processedSignatureUrl && (
                        <img
                          src={processedSignatureUrl}
                          alt="Signature Preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                    </div>

                    {/* Transparent Background & Ink Options */}
                    <div className="space-y-2.5 pt-2 border-t border-[#dae2fd]">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-medium text-[#131b2e] flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={removeBg}
                            onChange={(e) => setRemoveBg(e.target.checked)}
                            className="rounded border-[#dae2fd] text-[#00236f] focus:ring-0"
                          />
                          <span>Remove Paper Background (Transparent)</span>
                        </label>
                      </div>

                      {removeBg && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[#757682]">Bg Clean Filter:</span>
                          <input
                            type="range"
                            min="150"
                            max="245"
                            value={bgThreshold}
                            onChange={(e) => setBgThreshold(parseInt(e.target.value, 10))}
                            className="w-32 h-1.5 bg-[#dae2fd] rounded-lg appearance-none cursor-pointer accent-[#00236f]"
                          />
                          <span className="text-[11px] font-mono font-bold text-[#00236f]">
                            {bgThreshold}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-[#757682]">Ink Color:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInkEnhancement('dark-blue')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                              inkEnhancement === 'dark-blue'
                                ? 'bg-[#00236f] text-white border-[#00236f]'
                                : 'bg-white text-[#444651] border-[#dae2fd]'
                            }`}
                          >
                            Blue Ink
                          </button>
                          <button
                            type="button"
                            onClick={() => setInkEnhancement('black')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                              inkEnhancement === 'black'
                                ? 'bg-[#131b2e] text-white border-[#131b2e]'
                                : 'bg-white text-[#444651] border-[#dae2fd]'
                            }`}
                          >
                            Black Ink
                          </button>
                          <button
                            type="button"
                            onClick={() => setInkEnhancement('original')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                              inkEnhancement === 'original'
                                ? 'bg-slate-700 text-white border-slate-700'
                                : 'bg-white text-[#444651] border-[#dae2fd]'
                            }`}
                          >
                            Original
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Drawing Pad */
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#757682]">Ink:</span>
                    <button
                      type="button"
                      onClick={() => setDrawColor('#00236f')}
                      className={`w-5 h-5 rounded-full border-2 ${
                        drawColor === '#00236f' ? 'border-amber-400 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: '#00236f' }}
                      title="Blue Pen"
                    />
                    <button
                      type="button"
                      onClick={() => setDrawColor('#131b2e')}
                      className={`w-5 h-5 rounded-full border-2 ${
                        drawColor === '#131b2e' ? 'border-amber-400 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: '#131b2e' }}
                      title="Black Pen"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={clearDrawPad}
                    className="text-[11.5px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">refresh</span>
                    Clear Pad
                  </button>
                </div>

                <div className="relative rounded-xl border border-[#dae2fd] bg-white overflow-hidden shadow-inner">
                  <canvas
                    ref={drawCanvasRef}
                    width={400}
                    height={140}
                    onMouseDown={startDraw}
                    onMouseMove={drawMove}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={drawMove}
                    onTouchEnd={stopDraw}
                    className="w-full h-32 touch-none cursor-crosshair"
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#9aa0a6] text-[13px] font-medium">
                      Sign here using mouse or finger...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Attestation & Text Stamp Options Card */}
          <div className="bg-white rounded-xl p-5 border border-[#eaedff] shadow-sm">
            <span className="text-[11px] font-bold text-[#00236f] uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <span className="w-5 h-5 rounded-full bg-[#e2e7ff] text-[#00236f] flex items-center justify-center text-[11px] font-extrabold">
                3
              </span>
              Attestation &amp; Date Details
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-[11.5px] font-semibold text-[#444651] mb-1">
                  Self-Attestation Tag
                </label>
                <select
                  value={attestationType}
                  onChange={(e) => setAttestationType(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#dae2fd] text-[#131b2e] text-[12.5px] font-medium rounded-lg px-3 py-2 focus:outline-hidden focus:border-[#00236f]"
                >
                  <option value="Self Attested">Self Attested</option>
                  <option value="Digitally Signed">Digitally Signed</option>
                  <option value="Verified & Approved">Verified &amp; Approved</option>
                  <option value="True Copy Attested">True Copy Attested</option>
                  <option value="Countersigned">Countersigned</option>
                  <option value="None">None (Signature Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11.5px] font-semibold text-[#444651] mb-1">
                  Candidate / Signatory Name (Optional)
                </label>
                <input
                  type="text"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#f8fafc] border border-[#dae2fd] text-[#131b2e] text-[12.5px] font-medium rounded-lg px-3 py-2 focus:outline-hidden focus:border-[#00236f]"
                />
              </div>

              <div className="pt-2 border-t border-[#eaedff] flex items-center justify-between gap-3">
                <label className="text-[12px] font-medium text-[#131b2e] flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDate}
                    onChange={(e) => setIncludeDate(e.target.checked)}
                    className="rounded border-[#dae2fd] text-[#00236f] focus:ring-0"
                  />
                  <span>Stamp Date</span>
                </label>

                {includeDate && (
                  <input
                    type="text"
                    value={dateString}
                    onChange={(e) => setDateString(e.target.value)}
                    className="w-28 bg-[#f8fafc] border border-[#dae2fd] text-[#131b2e] text-[12px] font-mono rounded-lg px-2 py-1 text-center focus:outline-hidden focus:border-[#00236f]"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Action Button: Execute Stamping */}
          <button
            type="button"
            disabled={!pdfFile || !processedSignatureUrl || isStamping}
            onClick={handleExecuteSign}
            className="w-full py-3.5 px-5 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white font-bold text-[14px] shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isStamping ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Digitally Stamping PDF...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">download</span>
                <span>Download Signed PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Live Interactive Placement Canvas (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white rounded-xl p-5 border border-[#eaedff] shadow-sm flex flex-col">
            {/* Top Bar of Canvas Preview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#eaedff] mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#00236f]">visibility</span>
                <h4 className="font-['Outfit'] text-[15px] font-bold text-[#131b2e]">
                  Interactive Placement Canvas
                </h4>
                {pdfFile && (
                  <span className="text-[11px] text-[#757682] bg-[#f2f3ff] px-2 py-0.5 rounded-md font-mono">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>

              {/* Page Switcher Navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || pageRendering}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="w-8 h-8 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="text-[12px] font-bold text-[#131b2e] px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages || pageRendering}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="w-8 h-8 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-[#131b2e] disabled:opacity-30 flex items-center justify-center transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Alignment Preset Buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3 p-2 bg-[#f8fafc] rounded-lg border border-[#dae2fd]/60">
              <span className="text-[11.5px] font-semibold text-[#444651]">Quick Position:</span>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => applyPresetAlignment('bottom-right')}
                  className="px-2 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#dae2fd] text-[11px] font-medium text-[#00236f] shadow-2xs transition-colors cursor-pointer"
                >
                  Bottom Right (Applicant)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetAlignment('bottom-left')}
                  className="px-2 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#dae2fd] text-[11px] font-medium text-[#00236f] shadow-2xs transition-colors cursor-pointer"
                >
                  Bottom Left
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetAlignment('bottom-center')}
                  className="px-2 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#dae2fd] text-[11px] font-medium text-[#00236f] shadow-2xs transition-colors cursor-pointer"
                >
                  Bottom Center
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetAlignment('center')}
                  className="px-2 py-1 rounded bg-white hover:bg-[#eaedff] border border-[#dae2fd] text-[11px] font-medium text-[#00236f] shadow-2xs transition-colors cursor-pointer"
                >
                  Center
                </button>
              </div>
            </div>

            {/* Canvas Viewing Container with Drag & Drop Overlay */}
            <div className="relative w-full bg-[#333742] rounded-xl p-3 sm:p-6 flex items-center justify-center min-h-[500px] overflow-auto select-none">
              {pdfFile && pageDataUrl ? (
                <div
                  ref={containerRef}
                  className="relative bg-white shadow-2xl rounded-sm overflow-hidden"
                  style={{
                    width: '100%',
                    maxWidth: '560px',
                    aspectRatio: `${pageDimensions.width} / ${pageDimensions.height}`,
                  }}
                >
                  {/* Base PDF Page Image */}
                  <img
                    src={pageDataUrl}
                    alt={`PDF Page ${currentPage}`}
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* Interactive Signature Overlay Stamp */}
                  {processedSignatureUrl && (
                    <div
                      onMouseDown={handleMouseDownOnStamp}
                      className="absolute border-2 border-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-xs flex flex-col items-center justify-center p-1 cursor-grab active:cursor-grabbing group shadow-md transition-shadow"
                      style={{
                        left: `${position.xPercent}%`,
                        top: `${position.yPercent}%`,
                        width: `${position.widthPercent}%`,
                        height: `${position.heightPercent}%`,
                      }}
                    >
                      {/* Signature graphic inside stamp */}
                      <img
                        src={processedSignatureUrl}
                        alt="Placed Signature"
                        className="max-h-full max-w-full object-contain pointer-events-none"
                      />

                      {/* Attestation & Date label preview underneath */}
                      {(attestationType !== 'None' || signatoryName || includeDate) && (
                        <div className="absolute top-full left-0 mt-0.5 px-1 py-0.5 rounded bg-white/90 shadow-2xs text-[9px] font-bold text-[#00236f] pointer-events-none whitespace-nowrap leading-tight border border-[#dae2fd]/70">
                          {attestationType !== 'None' && <div>{attestationType}</div>}
                          {signatoryName && <div>By: {signatoryName}</div>}
                          {includeDate && <div className="text-[8px] text-[#444651]">Date: {dateString}</div>}
                        </div>
                      )}

                      {/* Resize Corner Handle at Bottom Right */}
                      <div
                        onMouseDown={handleMouseDownOnResize}
                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md cursor-se-resize flex items-center justify-center"
                        title="Drag to resize signature"
                      />

                      {/* Drag Hint Tooltip */}
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap">
                        Drag to move • Corner to resize
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center text-slate-300 mb-3">
                    <span className="material-symbols-outlined text-[32px]">picture_as_pdf</span>
                  </div>
                  <h4 className="text-[15px] font-bold text-white mb-1">
                    No PDF Document Loaded
                  </h4>
                  <p className="text-[12.5px] max-w-sm text-slate-300 mb-4">
                    Upload your document on step 1 to view pages and place your signature with exact live alignment.
                  </p>
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white font-semibold text-[13px] transition-colors cursor-pointer"
                  >
                    Select PDF File
                  </button>
                </div>
              )}
            </div>

            {/* Signature Size Slider for Fine Tuning */}
            {processedSignatureUrl && pdfFile && (
              <div className="mt-4 pt-3 border-t border-[#eaedff] flex items-center justify-between gap-4 flex-wrap text-[12px] text-[#444651]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Signature Width Scale:</span>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={position.widthPercent}
                    onChange={(e) => {
                      const newW = parseInt(e.target.value, 10);
                      const aspect = signatureDims.width / signatureDims.height;
                      const newH = Math.min(30, Math.max(4, Math.round(newW / (aspect * 1.4))));
                      setPosition((prev) => ({
                        ...prev,
                        widthPercent: newW,
                        heightPercent: newH,
                      }));
                    }}
                    className="w-36 h-1.5 bg-[#dae2fd] rounded-lg appearance-none cursor-pointer accent-[#00236f]"
                  />
                  <span className="font-mono font-bold text-[#00236f]">{position.widthPercent}%</span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#757682]">
                  <span>Coords: X: {Math.round(position.xPercent)}%, Y: {Math.round(position.yPercent)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Signed Output Success Card */}
          {signedResultStats && signedResultUrl && (
            <div className="bg-[#85f8c4]/15 border border-[#85f8c4]/60 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#004a32] text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">check_circle</span>
                </div>
                <div>
                  <h4 className="font-['Outfit'] text-[15px] font-bold text-[#003120]">
                    Signed PDF Ready &amp; Downloaded
                  </h4>
                  <p className="text-[12px] text-[#004a32]">
                    {signedResultStats.pages} Page{signedResultStats.pages > 1 ? 's' : ''} • {signedResultStats.sizeKb} KB • Stamped with high-precision vector alpha
                  </p>
                </div>
              </div>

              <a
                href={signedResultUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#eaedff] text-[#00236f] text-[12px] font-bold border border-[#dae2fd] transition-colors shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
