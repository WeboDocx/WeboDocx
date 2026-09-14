import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ToastMessage } from '../types';

interface QuickQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToast: (toast: Omit<ToastMessage, 'id'>) => void;
  defaultText?: string;
  defaultTitle?: string;
}

export const QuickQrModal: React.FC<QuickQrModalProps> = ({
  isOpen,
  onClose,
  onAddToast,
  defaultText = 'https://ssc.gov.in',
  defaultTitle = 'Exam Form Portal Link',
}) => {
  const [qrText, setQrText] = useState<string>(defaultText);
  const [qrTitle, setQrTitle] = useState<string>(defaultTitle);
  const [fgColor, setFgColor] = useState<string>('#00236f');
  const [errorCorrection, setErrorCorrection] = useState<'L' | 'M' | 'Q' | 'H'>('H');
  const [includeFrame, setIncludeFrame] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync state when props change or modal opens
  useEffect(() => {
    if (isOpen) {
      setQrText(defaultText || 'https://ssc.gov.in');
      setQrTitle(defaultTitle || 'Portal QR Code');
      setShowAdvanced(false);
    }
  }, [defaultText, defaultTitle, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Generate QR Canvas with controlled dimensions
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let payload = qrText.trim();
    if (!payload) payload = 'https://webodocx.gov.in';

    QRCode.toCanvas(canvas, payload, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: errorCorrection,
      color: {
        dark: fgColor,
        light: '#ffffff',
      },
    })
      .then(() => {
        if (canvas) {
          // Explicitly reset inline styles set by qrcode library so it stays bounded inside parent
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.maxWidth = '100%';
          canvas.style.maxHeight = '100%';
          canvas.style.objectFit = 'contain';
        }
      })
      .catch((err) => console.error('Quick QR generation failed', err));
  }, [qrText, fgColor, errorCorrection, isOpen]);

  if (!isOpen) return null;

  const isUrl = /^https?:\/\//i.test(qrText.trim());

  const handleDownloadPng = () => {
    const qrCanvas = canvasRef.current;
    if (!qrCanvas) return;

    let finalCanvas = qrCanvas;

    if (includeFrame) {
      const card = document.createElement('canvas');
      card.width = 600;
      card.height = 760;
      const ctx = card.getContext('2d');
      if (ctx) {
        // Card Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 600, 760);

        // Header Top Bar
        ctx.fillStyle = fgColor || '#00236f';
        ctx.fillRect(0, 0, 600, 64);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WeboDocx • Citizen Official Portal Access', 300, 40);

        // Title
        ctx.fillStyle = '#131b2e';
        ctx.font = 'bold 22px sans-serif';
        const displayTitle = qrTitle || 'Scan QR Code';
        if (displayTitle.length > 35) {
          ctx.fillText(displayTitle.slice(0, 35) + '...', 300, 108);
        } else {
          ctx.fillText(displayTitle, 300, 108);
        }

        // Subtitle
        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText('Scan with Mobile Camera, Google Lens or Any QR Scanner', 300, 138);

        // Canvas Border Container
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(73, 158, 454, 454);
        ctx.drawImage(qrCanvas, 75, 160, 450, 450);

        // URL display at bottom
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px monospace';
        const displayUrl = qrText.length > 52 ? qrText.slice(0, 52) + '...' : qrText;
        ctx.fillText(displayUrl, 300, 645);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText('100% In-Browser Privacy • Official Link Verification', 300, 680);

        finalCanvas = card;
      }
    }

    const url = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${(qrTitle || 'scheme_portal').replace(/[^a-z0-9_-]/gi, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onAddToast({
      title: 'QR Code PNG Downloaded',
      description: 'Quick QR code PNG successfully generated and downloaded.',
      type: 'success',
    });
  };

  const handleCopyImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        onAddToast({
          title: 'QR Code Image Copied',
          description: 'Image copied to clipboard, ready to paste.',
          type: 'success',
        });
      } catch {
        navigator.clipboard.writeText(qrText);
        onAddToast({
          title: 'Link URL Copied',
          description: 'Copied link text to clipboard.',
          type: 'info',
        });
      }
    }, 'image/png');
  };

  const handleCopyText = () => {
    if (!qrText) return;
    navigator.clipboard.writeText(qrText);
    onAddToast({
      title: 'URL Copied',
      description: 'Portal link copied to clipboard.',
      type: 'success',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#eaedff] dark:border-slate-800 w-full max-w-2xl lg:max-w-3xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Always Visible Close Button */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#eaedff] dark:border-slate-800 flex items-center justify-between bg-[#f8f9ff] dark:bg-slate-800/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#00236f] dark:bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">
                qr_code_2
              </span>
            </div>
            <div className="min-w-0">
              <h3
                id="qr-modal-title"
                className="font-bold text-[16px] sm:text-[18px] text-[#131b2e] dark:text-slate-100 truncate"
              >
                {qrTitle ? qrTitle : 'Official Portal QR Code'}
              </h3>
              <p className="text-[12px] sm:text-[12.5px] text-[#757682] dark:text-slate-400 truncate">
                Scan with any phone camera or Google Lens to open the portal instantly
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0 ml-3"
            title="Close (Esc)"
            aria-label="Close QR Modal"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Content Body - Perfectly Balanced Without Scrolling */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left Column: Focused, Prominent QR Code Box */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="w-full bg-[#f8f9ff] dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-[#dae2fd] dark:border-slate-700 flex flex-col items-center shadow-xs">
                {/* QR Canvas Box - Rigidly bounded container */}
                <div className="w-52 h-52 sm:w-56 sm:h-56 bg-white rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-center overflow-hidden shrink-0">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain block"
                    style={{
                      width: '100%',
                      height: '100%',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="material-symbols-outlined text-[16px] text-[#00236f] dark:text-indigo-400">
                    photo_camera
                  </span>
                  <span>Scan with Phone Camera</span>
                </div>

                {/* Direct Action Buttons under QR */}
                <div className="w-full mt-3 flex flex-col gap-2">
                  {isUrl && (
                    <a
                      href={qrText}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                      <span>Open Website</span>
                    </a>
                  )}

                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">link</span>
                      <span>Copy Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyImage}
                      className="py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span>Copy QR</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Portal Details & Appearance */}
            <div className="md:col-span-7 flex flex-col gap-3.5">
              {/* Target Portal URL Display */}
              <div className="p-3 rounded-xl bg-[#eef2ff] dark:bg-indigo-950/40 border border-[#dbeafe] dark:border-indigo-900/60 flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                    Official Portal URL
                  </span>
                  <p className="text-[12.5px] font-mono text-[#00236f] dark:text-indigo-300 break-all font-semibold select-all mt-0.5">
                    {qrText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0 mt-0.5"
                  title="Copy URL"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>

              {/* QR Customization Panel */}
              <div className="p-3.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-800/40 border border-[#dae2fd] dark:border-slate-700 flex flex-col gap-2.5">
                {/* Color Palette */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                    Theme Color:
                  </span>
                  <div className="flex items-center gap-2">
                    {[
                      { hex: '#00236f', name: 'Navy' },
                      { hex: '#0f172a', name: 'Slate Black' },
                      { hex: '#004a32', name: 'Forest Green' },
                      { hex: '#7f1d1d', name: 'Maroon' },
                      { hex: '#4f46e5', name: 'Indigo' },
                    ].map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => setFgColor(color.hex)}
                        title={color.name}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer border-2 ${
                          fgColor === color.hex
                            ? 'border-slate-900 dark:border-white ring-2 ring-indigo-400 scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* Error Correction / Quality */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                    Scan Quality:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {(['M', 'Q', 'H'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setErrorCorrection(level)}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer border ${
                          errorCorrection === level
                            ? 'bg-[#00236f] dark:bg-indigo-600 text-white border-transparent shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {level === 'M' ? 'Standard' : level === 'Q' ? 'High' : 'Ultra (H)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frame checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <input
                    type="checkbox"
                    checked={includeFrame}
                    onChange={(e) => setIncludeFrame(e.target.checked)}
                    className="w-4 h-4 rounded text-[#00236f] focus:ring-[#00236f]"
                  />
                  <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                    Include printable title &amp; official border on download
                  </span>
                </label>
              </div>

              {/* Collapsible Edit URL / Presets Section */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-[12px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">edit_note</span>
                    <span>Edit URL or Scheme Name</span>
                  </div>
                  <span className="material-symbols-outlined text-[18px]">
                    {showAdvanced ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {showAdvanced && (
                  <div className="p-3.5 bg-white dark:bg-slate-900 flex flex-col gap-2.5 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Target URL
                      </label>
                      <input
                        type="text"
                        value={qrText}
                        onChange={(e) => setQrText(e.target.value)}
                        placeholder="https://..."
                        className="w-full h-8 px-2.5 bg-[#f8f9ff] dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[12px] rounded-lg border border-[#dae2fd] dark:border-slate-700 focus:outline-none focus:border-[#00236f] font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Scheme / Card Label
                      </label>
                      <input
                        type="text"
                        value={qrTitle}
                        onChange={(e) => setQrTitle(e.target.value)}
                        placeholder="e.g. PM Vishwakarma Scheme"
                        className="w-full h-8 px-2.5 bg-[#f8f9ff] dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-[12px] rounded-lg border border-[#dae2fd] dark:border-slate-700 focus:outline-none focus:border-[#00236f]"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10.5px] font-bold text-slate-500">Presets:</span>
                      {[
                        { name: 'SSC', url: 'https://ssc.gov.in', title: 'SSC Official Portal' },
                        { name: 'UPSC', url: 'https://upsconline.nic.in', title: 'UPSC Online Portal' },
                        { name: 'DigiLocker', url: 'https://www.digilocker.gov.in', title: 'DigiLocker' },
                        { name: 'PM Kisan', url: 'https://pmkisan.gov.in', title: 'PM Kisan Nidhi' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setQrText(preset.url);
                            setQrTitle(preset.title);
                          }}
                          className="px-2 py-0.5 rounded bg-[#f2f3ff] dark:bg-slate-800 text-[#00236f] dark:text-indigo-300 text-[10.5px] font-semibold border border-[#dae2fd] dark:border-slate-700 hover:bg-[#e8ebff] cursor-pointer"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer with Clear, Always Accessible Close & Action Buttons */}
        <div className="px-5 sm:px-6 py-4 border-t border-[#eaedff] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9ff] dark:bg-slate-800/90 shrink-0">
          <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined text-[17px] text-emerald-600">
              verified
            </span>
            <span>100% In-Browser Privacy &bull; Instant PNG</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[13px] font-bold transition-colors cursor-pointer"
              aria-label="Close"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-5 py-2.5 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[13px] font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[19px]">
                download
              </span>
              <span>Download QR (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

