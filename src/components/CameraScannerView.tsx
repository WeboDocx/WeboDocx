import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ToastMessage,
  TaskManager,
  NavView,
  ScannedDocumentPage,
  ScanFilterMode,
  QuadCorners,
  Point2D,
} from '../types';
import {
  getDefaultCorners,
  autoDetectDocumentCorners,
  renderProcessedPageCanvas,
  exportScannedPagesToPdf,
} from '../utils/cameraScanner';
import JSZip from 'jszip';
import { recordRecentActivity } from '../utils/recentActivityStore';

interface CameraScannerViewProps {
  onNavigate: (view: NavView) => void;
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  taskManager?: TaskManager;
  language?: 'EN' | 'HI';
  initialImageFile?: File | null;
  onSendToOcr?: (file: File) => void;
  onSendToSigner?: (file: File) => void;
}

type GuideOverlay = 'a4' | 'id-card' | 'free';

export const CameraScannerView: React.FC<CameraScannerViewProps> = ({
  onNavigate,
  onAddToast,
  taskManager,
  language = 'EN',
  initialImageFile = null,
}) => {
  // Mode: 'camera' (live viewfinder), 'edit' (adjust crop, filter, rotate), 'review' (all pages overview)
  const [activeMode, setActiveMode] = useState<'camera' | 'edit' | 'review'>('camera');

  // Multi-Page document store
  const [pages, setPages] = useState<ScannedDocumentPage[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);

  // Live Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);
  const [guideOverlay, setGuideOverlay] = useState<GuideOverlay>('a4');
  const [multiPageBurstMode, setMultiPageBurstMode] = useState<boolean>(true);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);

  // Editor interactive crop state
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [editingCorners, setEditingCorners] = useState<QuadCorners>(getDefaultCorners());
  const [activeDragHandle, setActiveDragHandle] = useState<keyof QuadCorners | null>(null);
  const [magnifierPos, setMagnifierPos] = useState<{ x: number; y: number; normX: number; normY: number } | null>(null);
  const [isLiveProcessing, setIsLiveProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Filter preview cache
  const [previewFilterMap, setPreviewFilterMap] = useState<Record<ScanFilterMode, string>>({
    'magic-color': '',
    'doc-bw': '',
    'high-contrast': '',
    'grayscale': '',
    'original': '',
  });

  const currentPage = pages[selectedPageIndex] || null;

  // ==========================================
  // CAMERA HARDWARE INTEGRATION
  // ==========================================

  // Query cameras
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setCameraError('Camera access not supported in this browser.');
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        // Prefer back camera if available
        const backCam = videoDevices.find((d) =>
          /back|rear|environment|camera2 0/i.test(d.label)
        );
        setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      }
    } catch (err: any) {
      console.warn('Device enumeration error:', err);
    }
  }, [selectedCameraId]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) not supported in this browser.');
      }

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);

        // Check Torch capability
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities?.() || {};
        setHasTorchCapability(Boolean(capabilities.torch));
        setTorchEnabled(false);
      }

      await refreshDevices();
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setIsCameraActive(false);
      const isPermissionDenied =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const msg = isPermissionDenied
        ? 'Camera permission was denied. Please allow camera access in browser settings or upload document photos directly.'
        : `Could not access camera: ${err.message || 'Device busy or unavailable'}.`;
      setCameraError(msg);
    }
  }, [selectedCameraId, facingMode, refreshDevices]);

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setTorchEnabled(false);
  }, []);

  // Toggle Torch/Flash
  const toggleTorch = async () => {
    try {
      if (!videoRef.current || !videoRef.current.srcObject) return;
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (track && hasTorchCapability) {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchEnabled(nextState);
      }
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Flip Facing Mode
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setSelectedCameraId('');
  };

  useEffect(() => {
    if (activeMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeMode, selectedCameraId, facingMode, startCamera, stopCamera]);

  // Handle initial image file if passed
  useEffect(() => {
    if (initialImageFile) {
      handleProcessImageFile(initialImageFile);
    }
  }, [initialImageFile]);

  // ==========================================
  // CAPTURE & IMAGE INGESTION
  // ==========================================

  const handleCaptureSnapshot = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // Flash animation
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = vw;
    snapCanvas.height = vh;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, vw, vh);

    // Auto detect corners
    const detectedCorners = autoDetectDocumentCorners(snapCanvas);
    const rawDataUrl = snapCanvas.toDataURL('image/jpeg', 0.95);

    const newPage: ScannedDocumentPage = {
      id: `scan-page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pageNumber: pages.length + 1,
      originalDataUrl: rawDataUrl,
      processedDataUrl: rawDataUrl,
      thumbnailUrl: rawDataUrl,
      width: vw,
      height: vh,
      rotation: 0,
      filterMode: 'magic-color',
      brightness: 0,
      contrast: 0,
      corners: detectedCorners,
      isCropped: true,
      timestamp: Date.now(),
    };

    // Render initial processed page
    const processedCanvas = await renderProcessedPageCanvas(newPage);
    newPage.processedDataUrl = processedCanvas.toDataURL('image/jpeg', 0.92);
    newPage.thumbnailUrl = processedCanvas.toDataURL('image/jpeg', 0.6);

    const updatedPages = [...pages, newPage];
    setPages(updatedPages);
    setSelectedPageIndex(updatedPages.length - 1);

    onAddToast({
      title: `Page ${newPage.pageNumber} Captured!`,
      description: multiPageBurstMode
        ? 'Captured successfully. Position next page or click "Review & Export".'
        : 'Captured successfully. Adjust corners and enhance below.',
      type: 'success',
    });

    if (!multiPageBurstMode) {
      stopCamera();
      setActiveMode('edit');
    }
  };

  // Process uploaded image file
  const handleProcessImageFile = async (file: File) => {
    taskManager?.startTask(`Loading ${file.name}...`, 20, 'Reading image data...');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth || img.width;
      tempCanvas.height = img.naturalHeight || img.height;
      const ctx = tempCanvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      const detectedCorners = autoDetectDocumentCorners(tempCanvas);

      const newPage: ScannedDocumentPage = {
        id: `scan-page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageNumber: pages.length + 1,
        originalDataUrl: dataUrl,
        processedDataUrl: dataUrl,
        thumbnailUrl: dataUrl,
        width: tempCanvas.width,
        height: tempCanvas.height,
        rotation: 0,
        filterMode: 'magic-color',
        brightness: 0,
        contrast: 0,
        corners: detectedCorners,
        isCropped: true,
        timestamp: Date.now(),
      };

      const processedCanvas = await renderProcessedPageCanvas(newPage);
      newPage.processedDataUrl = processedCanvas.toDataURL('image/jpeg', 0.92);
      newPage.thumbnailUrl = processedCanvas.toDataURL('image/jpeg', 0.6);

      const updatedPages = [...pages, newPage];
      setPages(updatedPages);
      setSelectedPageIndex(updatedPages.length - 1);
      stopCamera();
      setActiveMode('edit');

      taskManager?.completeTask(`Loaded "${file.name}" ready for editing`, 300);
      onAddToast({
        title: 'Document Image Loaded',
        description: 'Auto-detected document boundaries. You can refine crop, rotate, or change filters.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('File load error:', err);
      taskManager?.failTask(`Failed to load image: ${err?.message}`);
      onAddToast({
        title: 'Could Not Load Image',
        description: err?.message || 'Unsupported file format.',
        type: 'error',
      });
    }
  };

  // ==========================================
  // PAGE EDITING & LIVE CANVAS RENDERING
  // ==========================================

  // Synchronize current page state with editor
  useEffect(() => {
    if (currentPage && activeMode === 'edit') {
      setEditingCorners(currentPage.corners || getDefaultCorners());
      generateFilterPreviews(currentPage);
    }
  }, [selectedPageIndex, activeMode]);

  // Generate thumbnail previews for each filter mode
  const generateFilterPreviews = async (page: ScannedDocumentPage) => {
    try {
      const modes: ScanFilterMode[] = ['magic-color', 'doc-bw', 'high-contrast', 'grayscale', 'original'];
      const map: Record<ScanFilterMode, string> = { ...previewFilterMap };

      for (const mode of modes) {
        const dummyPage = { ...page, filterMode: mode };
        const canvas = await renderProcessedPageCanvas(dummyPage);
        map[mode] = canvas.toDataURL('image/jpeg', 0.5);
      }
      setPreviewFilterMap(map);
    } catch (err) {
      console.warn('Filter preview generation error:', err);
    }
  };

  // Re-render and update current page in state
  const updateCurrentPage = async (updates: Partial<ScannedDocumentPage>) => {
    if (!currentPage) return;
    setIsLiveProcessing(true);

    try {
      const updatedPage: ScannedDocumentPage = {
        ...currentPage,
        ...updates,
      };

      const processedCanvas = await renderProcessedPageCanvas(updatedPage);
      updatedPage.processedDataUrl = processedCanvas.toDataURL('image/jpeg', 0.92);
      updatedPage.thumbnailUrl = processedCanvas.toDataURL('image/jpeg', 0.6);

      setPages((prev) =>
        prev.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p))
      );
    } catch (err) {
      console.error('Update page error:', err);
    } finally {
      setIsLiveProcessing(false);
    }
  };

  // Rotation handler
  const handleRotateCurrentPage = (deltaDegrees: number) => {
    if (!currentPage) return;
    const newRotation = ((currentPage.rotation + deltaDegrees) % 360 + 360) % 360;
    updateCurrentPage({ rotation: newRotation });
  };

  // Auto detect corners on current page
  const handleAutoDetectCorners = async () => {
    if (!currentPage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth || img.width;
      tempCanvas.height = img.naturalHeight || img.height;
      const ctx = tempCanvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      const detected = autoDetectDocumentCorners(tempCanvas);
      setEditingCorners(detected);
      updateCurrentPage({ corners: detected, isCropped: true });

      onAddToast({
        title: 'Auto Document Edges Aligned',
        description: 'Perspective quadrilateral fitted to high-contrast paper borders.',
        type: 'info',
      });
    };
    img.src = currentPage.originalDataUrl;
  };

  // Reset to full frame
  const handleResetFullFrame = () => {
    const fullCorners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
    };
    setEditingCorners(fullCorners);
    updateCurrentPage({ corners: fullCorners, isCropped: false });
  };

  // ==========================================
  // INTERACTIVE CORNER DRAG & MAGNIFIER
  // ==========================================

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const normX = Math.max(0, Math.min(1, x / rect.width));
    const normY = Math.max(0, Math.min(1, y / rect.height));
    return { x, y, normX, normY, clientX, clientY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!editorCanvasRef.current) return;
    const canvas = editorCanvasRef.current;
    const { normX, normY, clientX, clientY } = getCanvasCoords(e, canvas);

    // Find closest corner handle within threshold (15% distance)
    const corners = editingCorners;
    const keys: (keyof QuadCorners)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    let closestKey: keyof QuadCorners | null = null;
    let minDist = 0.15;

    for (const key of keys) {
      const c = corners[key];
      const dist = Math.hypot(c.x - normX, c.y - normY);
      if (dist < minDist) {
        minDist = dist;
        closestKey = key;
      }
    }

    if (closestKey) {
      setActiveDragHandle(closestKey);
      setMagnifierPos({ x: clientX, y: clientY, normX, normY });
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!activeDragHandle || !editorCanvasRef.current) return;
    const canvas = editorCanvasRef.current;
    const { normX, normY, clientX, clientY } = getCanvasCoords(e, canvas);

    setEditingCorners((prev) => ({
      ...prev,
      [activeDragHandle]: { x: normX, y: normY },
    }));
    setMagnifierPos({ x: clientX, y: clientY, normX, normY });
  };

  const handlePointerUp = () => {
    if (activeDragHandle && currentPage) {
      updateCurrentPage({ corners: editingCorners, isCropped: true });
    }
    setActiveDragHandle(null);
    setMagnifierPos(null);
  };

  // Draw overlay polygon and corner pins on the interactive canvas
  useEffect(() => {
    if (activeMode !== 'edit' || !currentPage || !editorCanvasRef.current) return;
    const canvas = editorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = Math.round((canvas.width * img.naturalHeight) / img.naturalWidth) || 450;

      const cw = canvas.width;
      const ch = canvas.height;

      // Draw base uncropped image
      ctx.drawImage(img, 0, 0, cw, ch);

      // Draw darkened backdrop outside crop polygon
      ctx.fillStyle = 'rgba(0, 15, 60, 0.45)';
      ctx.fillRect(0, 0, cw, ch);

      // Create clipping mask for the selected quad
      const tl = { x: editingCorners.topLeft.x * cw, y: editingCorners.topLeft.y * ch };
      const tr = { x: editingCorners.topRight.x * cw, y: editingCorners.topRight.y * ch };
      const br = { x: editingCorners.bottomRight.x * cw, y: editingCorners.bottomRight.y * ch };
      const bl = { x: editingCorners.bottomLeft.x * cw, y: editingCorners.bottomLeft.y * ch };

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.clip();

      // Redraw lit region inside polygon
      ctx.drawImage(img, 0, 0, cw, ch);

      // Draw 3x3 rule of thirds grid lines inside crop polygon
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        const ratio = i / 3;
        ctx.beginPath();
        ctx.moveTo(tl.x + (bl.x - tl.x) * ratio, tl.y + (bl.y - tl.y) * ratio);
        ctx.lineTo(tr.x + (br.x - tr.x) * ratio, tr.y + (br.y - tr.y) * ratio);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tl.x + (tr.x - tl.x) * ratio, tl.y + (tr.y - tl.y) * ratio);
        ctx.lineTo(bl.x + (br.x - bl.x) * ratio, bl.y + (br.y - bl.y) * ratio);
        ctx.stroke();
      }
      ctx.restore();

      // Draw bounding boundary border
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.stroke();

      // Draw Corner Handles with pulsating rings
      const cornerList = [
        { pt: tl, name: 'Top-Left' },
        { pt: tr, name: 'Top-Right' },
        { pt: br, name: 'Bottom-Right' },
        { pt: bl, name: 'Bottom-Left' },
      ];

      cornerList.forEach(({ pt }) => {
        // Outer glow
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
        ctx.fill();

        // Inner solid handle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#00236f';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00236f';
        ctx.fill();
      });
    };
    img.src = currentPage.originalDataUrl;
  }, [activeMode, currentPage, editingCorners]);

  // ==========================================
  // EXPORT & INTEGRATION ACTIONS
  // ==========================================

  // Export Multi-page PDF
  const handleDownloadPdf = async (pageSize: 'a4' | 'fit' = 'a4') => {
    if (!pages.length) return;
    setIsExporting(true);
    taskManager?.startTask('Generating Scanned PDF...', 20, 'Compiling and optimizing pages into PDF...');

    try {
      const pdfResult = await exportScannedPagesToPdf(pages, {
        pageSize,
        quality: 0.88,
        fileName: `WeboDocx_Scan_${pages.length}Pages_${Date.now()}.pdf`,
      });

      const a = document.createElement('a');
      a.href = pdfResult.dataUrl;
      a.download = pdfResult.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      recordRecentActivity({
        fileName: pdfResult.fileName,
        category: 'camera-scanner',
        fileType: 'pdf',
        sizeKb: pdfResult.sizeKb,
        details: `${pages.length} Pages • Camera Scan (${pageSize.toUpperCase()} Document)`,
        dataUrl: pdfResult.dataUrl,
      });

      taskManager?.completeTask(`PDF Exported (${pdfResult.sizeKb} KB, ${pages.length} pages)`, 500);
      onAddToast({
        title: 'Scanned PDF Downloaded!',
        description: `Generated ${pages.length}-page document (${pdfResult.sizeKb} KB). Ready for portal upload.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('PDF export error:', err);
      taskManager?.failTask(`Export failed: ${err?.message}`);
      onAddToast({
        title: 'PDF Export Failed',
        description: err?.message || 'Could not compile scanned pages.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Download All Pages as ZIP or current JPG
  const handleDownloadAllImagesZip = async () => {
    if (!pages.length) return;
    setIsExporting(true);
    taskManager?.startTask('Packaging High-Res Scan ZIP...', 20, 'Compressing scanned images...');

    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const canvas = await renderProcessedPageCanvas(page);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const base64Data = dataUrl.split(',')[1];
        zip.file(`Scanned_Page_${i + 1}.jpg`, base64Data, { base64: true });
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeboDocx_Scanned_Images_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      taskManager?.completeTask('ZIP Downloaded Successfully', 400);
      onAddToast({
        title: 'Images ZIP Downloaded',
        description: `Packaged ${pages.length} high-resolution scanned page(s).`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('ZIP export error:', err);
      taskManager?.failTask(`ZIP packaging failed: ${err?.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Send to OCR Extractor
  const handleTransferToOcr = async () => {
    if (!pages.length) return;
    setIsExporting(true);
    taskManager?.startTask('Transferring to OCR Engine...', 40, 'Rendering high-contrast document for OCR...');

    try {
      const pdfResult = await exportScannedPagesToPdf(pages, {
        pageSize: 'a4',
        quality: 0.92,
        fileName: `Scanned_Document_OCR_${Date.now()}.pdf`,
      });

      // Save to sessionStorage so OCR tool can pick it up immediately
      sessionStorage.setItem('WEBODOCX_PENDING_OCR_PDF', pdfResult.dataUrl);
      sessionStorage.setItem('WEBODOCX_PENDING_OCR_NAME', pdfResult.fileName);

      onNavigate('pdf-tools-compress');
      onAddToast({
        title: 'Document Transferred to OCR Engine!',
        description: 'Scanned pages loaded. Click "Start Optical Character Recognition" to extract all text.',
        type: 'info',
      });
    } catch (err: any) {
      console.error('OCR transfer error:', err);
      onAddToast({
        title: 'Transfer Failed',
        description: err?.message || 'Could not transfer to OCR.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Send to PDF Digital Signature
  const handleTransferToSigner = async () => {
    if (!pages.length) return;
    setIsExporting(true);
    taskManager?.startTask('Preparing for Digital Signature...', 40, 'Compiling scanned document...');

    try {
      const pdfResult = await exportScannedPagesToPdf(pages, {
        pageSize: 'a4',
        quality: 0.92,
        fileName: `Scanned_Document_Sign_${Date.now()}.pdf`,
      });

      sessionStorage.setItem('WEBODOCX_PENDING_SIGN_PDF', pdfResult.dataUrl);
      sessionStorage.setItem('WEBODOCX_PENDING_SIGN_NAME', pdfResult.fileName);

      onNavigate('pdf-tools-compress');
      onAddToast({
        title: 'Document Transferred to Digital Signer!',
        description: 'Place your official signature, stamp, or date anywhere on your scanned pages.',
        type: 'info',
      });
    } catch (err: any) {
      console.error('Signer transfer error:', err);
      onAddToast({
        title: 'Transfer Failed',
        description: err?.message || 'Could not transfer to Signer.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Delete page
  const handleDeletePage = (indexToDelete: number) => {
    const updated = pages.filter((_, i) => i !== indexToDelete).map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    setPages(updated);
    if (updated.length === 0) {
      setActiveMode('camera');
    } else {
      setSelectedPageIndex(Math.min(selectedPageIndex, updated.length - 1));
    }
    onAddToast({
      title: 'Page Removed',
      description: `Document now has ${updated.length} page(s).`,
      type: 'info',
    });
  };

  // Reorder page
  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    const copy = [...pages];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    const renumbered = copy.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));
    setPages(renumbered);
    setSelectedPageIndex(targetIndex);
  };

  return (
    <div id="mobile-camera-scanner-container" className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#eaedff] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#00236f] text-white flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[26px]">
              photo_camera
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-['Outfit'] text-[22px] sm:text-[24px] font-bold text-[#00236f] tracking-tight">
                {language === 'EN' ? 'Mobile Camera Document Scanner' : 'मोबाइल कैमरा डॉक्यूमेंट स्कैनर'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#85f8c4]/30 text-[#003120] text-[11px] font-bold tracking-wide uppercase border border-[#85f8c4]">
                100% In-Browser Privacy
              </span>
            </div>
            <p className="text-[13px] text-[#444651]">
              Capture documents directly with your phone/webcam, auto-crop perspective borders, enhance ink legibility, and convert to PDF or OCR.
            </p>
          </div>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="flex items-center gap-1 bg-[#f2f3ff] p-1 rounded-xl border border-[#dae2fd]">
          <button
            type="button"
            onClick={() => {
              setActiveMode('camera');
            }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeMode === 'camera'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'text-[#444651] hover:text-[#00236f] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            <span>Live Camera</span>
          </button>

          <button
            type="button"
            disabled={pages.length === 0}
            onClick={() => {
              stopCamera();
              setActiveMode('edit');
            }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 ${
              activeMode === 'edit'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'text-[#444651] hover:text-[#00236f] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">crop</span>
            <span>Crop &amp; Filters ({pages.length})</span>
          </button>

          <button
            type="button"
            disabled={pages.length === 0}
            onClick={() => {
              stopCamera();
              setActiveMode('review');
            }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 ${
              activeMode === 'review'
                ? 'bg-[#00236f] text-white shadow-xs'
                : 'text-[#444651] hover:text-[#00236f] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            <span>Pages &amp; PDF</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: LIVE CAMERA VIEWFINDER                                            */}
      {/* ========================================================================= */}
      {activeMode === 'camera' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Viewfinder Card (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="relative bg-[#050b1a] rounded-2xl overflow-hidden shadow-md border border-[#1e293b] aspect-4/3 sm:aspect-16/10 flex items-center justify-center">
              {/* Live Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isCameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Shutter Flash Animation */}
              {shutterFlash && (
                <div className="absolute inset-0 bg-white z-30 transition-opacity duration-200 pointer-events-none" />
              )}

              {/* Camera Offline / Permission Prompt */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[#050b1a]/95">
                  <div className="w-16 h-16 rounded-full bg-white/10 text-white flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[32px]">
                      videocam_off
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-[18px] mb-1">
                    {cameraError ? 'Camera Unavailable' : 'Starting Camera Viewfinder...'}
                  </h3>
                  <p className="text-white/70 text-[13px] max-w-md mb-4 leading-relaxed">
                    {cameraError || 'Please allow camera permissions when prompted to scan documents in high resolution.'}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[13px] font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      <span>Retry Camera Access</span>
                    </button>

                    <label className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-[13px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer">
                      <span className="material-symbols-outlined text-[18px]">upload_file</span>
                      <span>Upload Document Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleProcessImageFile(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Real-time Framing Guide Overlays */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-6">
                  {guideOverlay === 'a4' && (
                    <div className="w-[72%] h-[88%] border-2 border-dashed border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] relative flex items-start justify-between p-2">
                      <span className="bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded tracking-wider uppercase font-bold">
                        A4 Document / Certificate
                      </span>
                      <div className="w-4 h-4 border-t-2 border-r-2 border-[#85f8c4]" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#85f8c4]" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#85f8c4]" />
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#85f8c4]" />
                    </div>
                  )}

                  {guideOverlay === 'id-card' && (
                    <div className="w-[85%] h-[58%] border-2 border-dashed border-[#85f8c4] rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative flex items-start justify-between p-3">
                      <span className="bg-black/70 text-[#85f8c4] text-[10px] font-mono px-2.5 py-0.5 rounded tracking-wider uppercase font-bold">
                        Aadhaar / Voter / PAN Card (3:2)
                      </span>
                      <div className="w-5 h-5 border-t-2 border-r-2 border-[#85f8c4]" />
                      <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-[#85f8c4]" />
                      <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-[#85f8c4]" />
                      <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-[#85f8c4]" />
                    </div>
                  )}
                </div>
              )}

              {/* Viewfinder Top Floating Controls */}
              {isCameraActive && (
                <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                  {/* Torch Toggle */}
                  {hasTorchCapability ? (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                        torchEnabled
                          ? 'bg-[#ffe885] text-[#291e00] shadow-md'
                          : 'bg-black/50 text-white hover:bg-black/70'
                      }`}
                      title={torchEnabled ? 'Turn Off Flash/Torch' : 'Turn On Flash/Torch'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {torchEnabled ? 'flash_on' : 'flash_off'}
                      </span>
                    </button>
                  ) : <div />}

                  {/* Guide Mode Chips */}
                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-full text-white text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setGuideOverlay('a4')}
                      className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                        guideOverlay === 'a4' ? 'bg-white text-[#00236f]' : 'hover:bg-white/20'
                      }`}
                    >
                      A4 Sheet
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuideOverlay('id-card')}
                      className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                        guideOverlay === 'id-card' ? 'bg-white text-[#00236f]' : 'hover:bg-white/20'
                      }`}
                    >
                      ID Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuideOverlay('free')}
                      className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                        guideOverlay === 'free' ? 'bg-white text-[#00236f]' : 'hover:bg-white/20'
                      }`}
                    >
                      Freeform
                    </button>
                  </div>

                  {/* Flip Camera */}
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-all cursor-pointer"
                    title="Switch Front / Rear Camera"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      flip_camera_ios
                    </span>
                  </button>
                </div>
              )}

              {/* Big Floating Shutter Control */}
              {isCameraActive && (
                <div className="absolute bottom-4 inset-x-0 flex flex-col items-center justify-center gap-2 z-20 pointer-events-auto">
                  <div className="flex items-center gap-6">
                    {/* Multi-Page Indicator button */}
                    <button
                      type="button"
                      disabled={pages.length === 0}
                      onClick={() => {
                        stopCamera();
                        setActiveMode('edit');
                      }}
                      className="relative px-3 py-2 rounded-xl bg-black/60 hover:bg-black/80 text-white text-[12px] font-bold backdrop-blur-md border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        photo_library
                      </span>
                      <span>{pages.length} Pages</span>
                    </button>

                    {/* Shutter Button */}
                    <button
                      id="scanner-shutter-btn"
                      type="button"
                      onClick={handleCaptureSnapshot}
                      className="w-18 h-18 rounded-full bg-white p-1.5 shadow-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer group"
                      title="Capture Document Page"
                    >
                      <div className="w-full h-full rounded-full border-3 border-[#00236f] bg-white group-hover:bg-[#f2f3ff] flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[#00236f] text-[28px]">
                          camera
                        </span>
                      </div>
                    </button>

                    {/* Burst Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => setMultiPageBurstMode(!multiPageBurstMode)}
                      className={`px-3 py-2 rounded-xl text-[12px] font-bold backdrop-blur-md border flex items-center gap-1.5 transition-all cursor-pointer ${
                        multiPageBurstMode
                          ? 'bg-[#85f8c4] text-[#003120] border-[#85f8c4] shadow-md'
                          : 'bg-black/60 text-white/80 border-white/20 hover:bg-black/80'
                      }`}
                      title="Continuous Multi-page capture without leaving camera"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        auto_mode
                      </span>
                      <span>Multi-Page: {multiPageBurstMode ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Settings & Upload Tray (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Quick Capture Options */}
            <div className="bg-white p-5 rounded-2xl border border-[#eaedff] shadow-xs flex flex-col gap-4">
              <h3 className="font-['Outfit'] text-[16px] font-bold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00236f] text-[20px]">
                  settings
                </span>
                <span>Scanner Controls</span>
              </h3>

              {/* Camera Device Dropdown */}
              {availableCameras.length > 1 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-[#757682] uppercase tracking-wider">
                    Select Camera Lens
                  </label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="h-10 px-3 bg-[#f8f9ff] rounded-xl border border-[#dae2fd] text-[13px] text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#00236f]"
                  >
                    {availableCameras.map((cam, idx) => (
                      <option key={cam.deviceId || idx} value={cam.deviceId}>
                        {cam.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload Alternative */}
              <div className="pt-2 border-t border-[#eaedff]">
                <label className="text-[11px] font-bold text-[#757682] uppercase tracking-wider mb-2 block">
                  Or Upload From Device Storage
                </label>
                <label className="border-2 border-dashed border-[#dae2fd] hover:border-[#00236f] bg-[#f8f9ff] hover:bg-[#f2f3ff] p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                  <span className="material-symbols-outlined text-[#00236f] text-[28px] mb-1">
                    cloud_upload
                  </span>
                  <span className="text-[13px] font-bold text-[#00236f]">
                    Choose Photos or Scans
                  </span>
                  <span className="text-[11px] text-[#757682] mt-0.5">
                    JPG, PNG, WebP up to 25MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const fileList = Array.from(e.target.files) as File[];
                        fileList.forEach((f) => handleProcessImageFile(f));
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Multi-Page Counter & Action */}
              {pages.length > 0 && (
                <div className="bg-[#eef2ff] p-3.5 rounded-xl border border-[#c7d2fe] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-[#1e1b4b]">
                      📄 {pages.length} Page(s) Scanned
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setActiveMode('edit');
                      }}
                      className="text-[12px] font-bold text-[#00236f] hover:underline"
                    >
                      Edit Crops &rarr;
                    </button>
                  </div>

                  {/* Thumbnail strip */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {pages.map((p, idx) => (
                      <div
                        key={p.id}
                        className="relative w-12 h-16 rounded-md overflow-hidden border border-[#dae2fd] shrink-0 bg-white shadow-2xs"
                      >
                        <img
                          src={p.thumbnailUrl || p.processedDataUrl}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-bold text-center">
                          P.{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setActiveMode('review');
                    }}
                    className="w-full py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-bold text-[12px] rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      picture_as_pdf
                    </span>
                    <span>Finish &amp; Export PDF ({pages.length})</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: INTERACTIVE CROP & ENHANCEMENT EDITOR                             */}
      {/* ========================================================================= */}
      {activeMode === 'edit' && currentPage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Interactive Canvas Editor (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="bg-white p-4 rounded-2xl border border-[#eaedff] shadow-xs flex flex-col gap-3">
              {/* Top Crop Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#eaedff]">
                <div className="flex items-center gap-2">
                  <span className="font-['Outfit'] text-[16px] font-bold text-[#00236f]">
                    Page {currentPage.pageNumber} of {pages.length}
                  </span>
                  <span className="text-[11px] text-[#757682]">
                    (Drag 4 corner pins to align document)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAutoDetectCorners}
                    className="px-2.5 py-1 bg-[#e2e7ff] hover:bg-[#d0daff] text-[#00236f] text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    title="Auto-detect high contrast document borders"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                    <span>Auto-Align Edges</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetFullFrame}
                    className="px-2.5 py-1 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#444651] text-[11px] font-bold rounded-lg border border-[#dae2fd] flex items-center gap-1 transition-all cursor-pointer"
                    title="Reset to full picture frame"
                  >
                    <span className="material-symbols-outlined text-[14px]">fullscreen</span>
                    <span>Full Frame</span>
                  </button>
                </div>
              </div>

              {/* Interactive Draggable Canvas Container */}
              <div
                className="relative bg-[#050b1a] rounded-xl overflow-hidden shadow-inner flex items-center justify-center cursor-crosshair touch-none select-none p-1"
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              >
                <canvas ref={editorCanvasRef} className="max-w-full h-auto rounded-lg shadow-sm" />

                {/* Magnifying Loupe for Pinpoint Corner Placement */}
                {magnifierPos && (
                  <div
                    className="fixed pointer-events-none z-50 w-24 h-24 rounded-full border-3 border-[#00236f] shadow-2xl overflow-hidden bg-white"
                    style={{
                      left: `${magnifierPos.x - 48}px`,
                      top: `${magnifierPos.y - 120}px`,
                    }}
                  >
                    <div
                      className="w-full h-full relative"
                      style={{
                        backgroundImage: `url(${currentPage.originalDataUrl})`,
                        backgroundPosition: `${magnifierPos.normX * 100}% ${magnifierPos.normY * 100}%`,
                        backgroundSize: '400%',
                        backgroundRepeat: 'no-repeat',
                      }}
                    >
                      {/* Center crosshair */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 border-2 border-red-500 rounded-full" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Quick Rotation Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleRotateCurrentPage(270)}
                    className="px-2.5 py-1.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#00236f] text-[12px] font-bold rounded-lg border border-[#dae2fd] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">rotate_left</span>
                    <span>90° CCW</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotateCurrentPage(90)}
                    className="px-2.5 py-1.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#00236f] text-[12px] font-bold rounded-lg border border-[#dae2fd] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">rotate_right</span>
                    <span>90° CW</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRotateCurrentPage(180)}
                    className="px-2.5 py-1.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#00236f] text-[12px] font-bold rounded-lg border border-[#dae2fd] flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    <span>180° Flip</span>
                  </button>
                </div>

                <div className="text-[12px] font-semibold text-[#757682]">
                  Rotation: {currentPage.rotation}°
                </div>
              </div>
            </div>
          </div>

          {/* Right Filters & Adjustments Panel (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Live Processed Output Preview Card */}
            <div className="bg-white p-4 rounded-2xl border border-[#eaedff] shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-1 border-b border-[#eaedff]">
                <h3 className="font-['Outfit'] text-[15px] font-bold text-[#00236f] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  <span>Enhancement Filters</span>
                </h3>
                {isLiveProcessing && (
                  <span className="text-[11px] text-[#00236f] font-semibold animate-pulse">
                    Rendering...
                  </span>
                )}
              </div>

              {/* Filter Cards Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { mode: 'magic-color', label: 'Magic Color', desc: 'Crisp + Ink Colors' },
                  { mode: 'doc-bw', label: 'Clean B&W', desc: 'Photocopy' },
                  { mode: 'high-contrast', label: 'High Contrast', desc: 'Sharp Text' },
                  { mode: 'grayscale', label: 'Grayscale', desc: 'Monochrome' },
                  { mode: 'original', label: 'Original', desc: 'Natural' },
                ].map(({ mode, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateCurrentPage({ filterMode: mode as ScanFilterMode })}
                    className={`flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer text-center ${
                      currentPage.filterMode === mode
                        ? 'bg-[#e2e7ff] border-[#00236f] ring-2 ring-[#00236f]/30'
                        : 'bg-[#f8f9ff] border-[#dae2fd] hover:bg-[#f2f3ff]'
                    }`}
                  >
                    <div className="w-full h-12 rounded-lg bg-gray-200 overflow-hidden mb-1 shadow-2xs">
                      {previewFilterMap[mode as ScanFilterMode] ? (
                        <img
                          src={previewFilterMap[mode as ScanFilterMode]}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400">
                          {label}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-[#131b2e] truncate w-full">
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Brightness & Contrast Sliders */}
              <div className="pt-2 border-t border-[#eaedff] flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold text-[#444651]">
                    <span>Brightness</span>
                    <span>{currentPage.brightness > 0 ? `+${currentPage.brightness}` : currentPage.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="2"
                    value={currentPage.brightness}
                    onChange={(e) => updateCurrentPage({ brightness: parseInt(e.target.value) })}
                    className="w-full accent-[#00236f] cursor-pointer h-1.5 bg-[#dae2fd] rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] font-bold text-[#444651]">
                    <span>Contrast</span>
                    <span>{currentPage.contrast > 0 ? `+${currentPage.contrast}` : currentPage.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="2"
                    value={currentPage.contrast}
                    onChange={(e) => updateCurrentPage({ contrast: parseInt(e.target.value) })}
                    className="w-full accent-[#00236f] cursor-pointer h-1.5 bg-[#dae2fd] rounded-lg"
                  />
                </div>
              </div>

              {/* Clean Processed Thumbnail Preview */}
              <div className="mt-1 p-2 bg-[#f8f9ff] rounded-xl border border-[#dae2fd] flex items-center gap-3">
                <div className="w-16 h-20 bg-white rounded-lg overflow-hidden border border-[#dae2fd] shadow-xs shrink-0">
                  <img
                    src={currentPage.processedDataUrl}
                    alt="Processed result"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-[#131b2e]">
                    Result Preview (Page {currentPage.pageNumber})
                  </div>
                  <div className="text-[11px] text-[#757682] mt-0.5">
                    Filter: {currentPage.filterMode} | Rotated {currentPage.rotation}°
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMode('review')}
                    className="mt-2 text-[11.5px] font-bold text-[#00236f] hover:underline flex items-center gap-1"
                  >
                    <span>Go to PDF Export &rarr;</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Multi-Page Navigation Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#eaedff] shadow-xs flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveMode('camera')}
                className="px-3 py-2 bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#00236f] text-[12px] font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                <span>+ Scan Next Page</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('review')}
                className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[12px] font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Review All ({pages.length})</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: ALL PAGES OVERVIEW & PDF EXPORT STUDIO                             */}
      {/* ========================================================================= */}
      {activeMode === 'review' && (
        <div className="flex flex-col gap-6">
          {/* Main Action Hub Toolbar */}
          <div className="bg-white p-5 rounded-2xl border border-[#eaedff] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e2e7ff] text-[#00236f] flex items-center justify-center font-bold text-[18px]">
                {pages.length}
              </div>
              <div>
                <h3 className="font-['Outfit'] text-[18px] font-bold text-[#131b2e]">
                  Ready to Export {pages.length} Scanned Page(s)
                </h3>
                <p className="text-[12px] text-[#757682]">
                  All pages cropped, deskewed, and enhanced for crisp official submission.
                </p>
              </div>
            </div>

            {/* High-Level Conversion Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Download Multi-Page PDF */}
              <button
                id="export-scanned-pdf-btn"
                type="button"
                disabled={isExporting || pages.length === 0}
                onClick={() => handleDownloadPdf('a4')}
                className="px-4 py-2.5 bg-[#00236f] hover:bg-[#1e3a8a] text-white font-bold text-[13px] rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  picture_as_pdf
                </span>
                <span>Download A4 PDF</span>
              </button>

              {/* 1-Click Send to OCR Text Extractor */}
              <button
                id="scanner-send-to-ocr-btn"
                type="button"
                disabled={isExporting || pages.length === 0}
                onClick={handleTransferToOcr}
                className="px-3.5 py-2.5 bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#00236f] font-bold text-[13px] rounded-xl border border-[#dae2fd] flex items-center gap-1.5 transition-all cursor-pointer"
                title="Extract all text characters and names using OCR"
              >
                <span className="material-symbols-outlined text-[18px]">
                  document_scanner
                </span>
                <span>Extract Text (OCR)</span>
              </button>

              {/* 1-Click Send to Digital Signature */}
              <button
                id="scanner-send-to-sign-btn"
                type="button"
                disabled={isExporting || pages.length === 0}
                onClick={handleTransferToSigner}
                className="px-3.5 py-2.5 bg-[#f2f3ff] hover:bg-[#e2e7ff] text-[#00236f] font-bold text-[13px] rounded-xl border border-[#dae2fd] flex items-center gap-1.5 transition-all cursor-pointer"
                title="Place signature or official stamp on this document"
              >
                <span className="material-symbols-outlined text-[18px]">
                  ink_pen
                </span>
                <span>Sign &amp; Stamp</span>
              </button>

              {/* Download ZIP Images */}
              <button
                type="button"
                disabled={isExporting || pages.length === 0}
                onClick={handleDownloadAllImagesZip}
                className="p-2.5 bg-[#f8f9ff] hover:bg-[#eaedff] text-[#444651] rounded-xl border border-[#dae2fd] transition-all cursor-pointer"
                title="Download all scanned pages as high-resolution JPG ZIP archive"
              >
                <span className="material-symbols-outlined text-[18px]">
                  folder_zip
                </span>
              </button>
            </div>
          </div>

          {/* Grid of Pages for Reordering, Editing & Deleting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className="group relative bg-white rounded-2xl p-3 border border-[#eaedff] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* Image Preview */}
                <div>
                  <div className="relative aspect-3/4 rounded-xl overflow-hidden bg-gray-100 border border-[#dae2fd] mb-2.5">
                    <img
                      src={page.processedDataUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-contain bg-white"
                    />
                    <div className="absolute top-2 left-2 bg-[#00236f] text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                      Page {page.pageNumber}
                    </div>

                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {page.filterMode}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#757682] px-1 mb-2">
                    <span>Rotated: {page.rotation}°</span>
                    <span>{page.isCropped ? 'Auto-Cropped' : 'Full Frame'}</span>
                  </div>
                </div>

                {/* Page Action Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-[#eaedff]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMovePage(idx, 'left')}
                      className="p-1 rounded-lg hover:bg-[#f2f3ff] text-[#444651] disabled:opacity-30 cursor-pointer"
                      title="Move Page Left"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    </button>

                    <button
                      type="button"
                      disabled={idx === pages.length - 1}
                      onClick={() => handleMovePage(idx, 'right')}
                      className="p-1 rounded-lg hover:bg-[#f2f3ff] text-[#444651] disabled:opacity-30 cursor-pointer"
                      title="Move Page Right"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPageIndex(idx);
                        setActiveMode('edit');
                      }}
                      className="px-2 py-1 bg-[#e2e7ff] hover:bg-[#d0daff] text-[#00236f] text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePage(idx)}
                      className="p-1 rounded-lg hover:bg-red-50 text-red-600 transition-all cursor-pointer"
                      title="Delete Page"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add More Pages Card */}
            <div
              onClick={() => setActiveMode('camera')}
              className="border-2 border-dashed border-[#dae2fd] hover:border-[#00236f] bg-[#f8f9ff] hover:bg-[#f2f3ff] rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all aspect-3/4 group"
            >
              <div className="w-12 h-12 rounded-full bg-[#e2e7ff] group-hover:bg-[#00236f] text-[#00236f] group-hover:text-white flex items-center justify-center transition-colors mb-2">
                <span className="material-symbols-outlined text-[24px]">
                  add_a_photo
                </span>
              </div>
              <span className="font-['Outfit'] font-bold text-[14px] text-[#00236f]">
                + Scan Another Page
              </span>
              <span className="text-[11px] text-[#757682] mt-0.5">
                Add certificate, back side of ID, or marksheet
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
