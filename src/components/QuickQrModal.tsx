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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (defaultText) setQrText(defaultText);
    if (defaultTitle) setQrTitle(defaultTitle);
  }, [defaultText, defaultTitle, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let payload = qrText.trim();
    if (!payload) payload = 'WeboDocx';

    QRCode.toCanvas(canvas, payload, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: errorCorrection,
      color: {
        dark: fgColor,
        light: '#ffffff',
      },
    }).catch((err) => console.error('Quick QR generation failed', err));
  }, [qrText, fgColor, errorCorrection, isOpen]);

  if (!isOpen) return null;

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
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 600, 760);

        ctx.fillStyle = '#00236f';
        ctx.fillRect(0, 0, 600, 60);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WeboDocx Citizen Utility', 300, 38);

        ctx.fillStyle = '#131b2e';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(qrTitle || 'Scan QR Code', 300, 110);

        ctx.fillStyle = '#757682';
        ctx.font = '16px sans-serif';
        ctx.fillText('Scan with Phone Camera or Google Lens', 300, 138);

        ctx.drawImage(qrCanvas, 75, 160, 450, 450);

        ctx.fillStyle = '#757682';
        ctx.font = '14px sans-serif';
        ctx.fillText('100% In-Browser Privacy • Official Link', 300, 670);

        finalCanvas = card;
      }
    }

    const url = finalCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${(qrTitle || 'download').replace(/[^a-z0-9_-]/gi, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onAddToast({
      title: 'QR PNG Downloaded',
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
          title: 'QR Code Copied',
          description: 'Image ready to paste into documents or messaging.',
          type: 'success',
        });
      } catch {
        navigator.clipboard.writeText(qrText);
        onAddToast({
          title: 'Link Text Copied',
          description: 'Copied link text to clipboard.',
          type: 'info',
        });
      }
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-[#eaedff] w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#eaedff] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00236f] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                qr_code_2
              </span>
            </div>
            <div>
              <h3 className="font-['Outfit'] text-[16px] font-bold text-[#131b2e]">
                Quick QR Code Generator
              </h3>
              <p className="text-[11.5px] text-[#757682]">
                Create &amp; download instant PNG QR for forms, links &amp; contacts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#757682] hover:bg-[#eaedff] flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-bold text-[#131b2e]">
              URL, Contact Info, or Custom Text
            </label>
            <input
              type="text"
              value={qrText}
              onChange={(e) => setQrText(e.target.value)}
              placeholder="e.g. https://ssc.gov.in or contact details"
              className="w-full h-10 px-3 bg-[#f8f9ff] text-[13px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-bold text-[#131b2e]">
              Card Header Title (Optional)
            </label>
            <input
              type="text"
              value={qrTitle}
              onChange={(e) => setQrTitle(e.target.value)}
              placeholder="e.g. Scan for Application Form"
              className="w-full h-9 px-3 bg-[#f8f9ff] text-[12.5px] rounded-lg border border-[#dae2fd] focus:outline-none focus:border-[#00236f]"
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#757682]">Presets:</span>
            <button
              type="button"
              onClick={() => {
                setQrText('https://ssc.gov.in');
                setQrTitle('SSC Official Portal');
              }}
              className="px-2 py-0.5 rounded bg-[#f2f3ff] text-[#00236f] text-[11px] font-semibold border border-[#dae2fd]"
            >
              SSC Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setQrText('https://upsconline.nic.in');
                setQrTitle('UPSC Online Application');
              }}
              className="px-2 py-0.5 rounded bg-[#f2f3ff] text-[#00236f] text-[11px] font-semibold border border-[#dae2fd]"
            >
              UPSC Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setQrText('https://www.digilocker.gov.in');
                setQrTitle('DigiLocker Verification');
              }}
              className="px-2 py-0.5 rounded bg-[#f2f3ff] text-[#00236f] text-[11px] font-semibold border border-[#dae2fd]"
            >
              DigiLocker
            </button>
          </div>

          {/* QR Preview & Options */}
          <div className="flex items-center justify-between gap-4 bg-[#f8f9ff] p-4 rounded-xl border border-[#dae2fd]">
            <div className="p-2 bg-white rounded-lg shadow-2xs border border-[#eaedff]">
              <canvas
                ref={canvasRef}
                className="w-32 h-32 object-contain"
              />
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFrame}
                  onChange={(e) => setIncludeFrame(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00236f]"
                />
                <span className="text-[11.5px] font-semibold text-[#131b2e]">
                  Include Printable Title Frame
                </span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#757682]">Color:</span>
                {['#00236f', '#000000', '#004d26', '#8b0000'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFgColor(color)}
                    className={`w-6 h-6 rounded-full border ${
                      fgColor === color ? 'ring-2 ring-[#00236f] scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <span className="text-[10.5px] text-[#757682]">
                100% In-Browser • Fast &amp; High-Resolution PNG
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#eaedff] flex items-center justify-between bg-[#f8f9ff]">
          <button
            type="button"
            onClick={handleCopyImage}
            className="px-3 py-2 rounded-xl text-[#444651] hover:text-[#131b2e] hover:bg-[#eaedff] text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">
              content_copy
            </span>
            <span>Copy Image</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-[#757682] hover:bg-[#eaedff] text-[12.5px] font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-4 py-2 rounded-xl bg-[#00236f] hover:bg-[#1e3a8a] text-white text-[12.5px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                download
              </span>
              <span>Download PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
